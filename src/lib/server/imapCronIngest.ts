/**
 * Background IMAP ingestion: connect per user (Gmail + App Password),
 * search transactional mail, merge order + delivery emails, upsert `orders`,
 * then delay letter + in-app notification when applicable.
 */

import { simpleParser } from 'mailparser';
import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeAppPassword } from '@/lib/appPasswordNormalize';
import { decryptAppPassword } from '@/lib/server/gmailImapCrypto';
import {
  createGmailImapClient,
  isLikelyTransientImapFailure,
  mapImapErrorToUserMessage,
  sleep,
} from '@/lib/server/gmailImapHelpers';
import {
  buildGmailImapRawQuery,
  IMAP_MAX_MESSAGES_DEFAULT,
  IMAP_MAX_MESSAGES_DEEP,
} from '@/lib/server/imapAllowedSenders';
import { mergeParsedOrdersByMerchantId, type ParsedMessageRow } from '@/lib/server/imapOrderMerge';
import {
  isDelayedOverMinutes,
  isOrderLateForRefundStatus,
  parseMailToOrder,
  type ParsedImapOrder,
} from '@/lib/server/parseImapOrderEmail';
import { triggerDelayLetterIfNeeded } from '@/lib/server/imapDelayLetter';

export type ImapCredentialRow = {
  user_id: string;
  gmail_address: string;
  encrypted_app_password: string;
};

export type CronUserResult = {
  user_id: string;
  gmail_address: string;
  fetched: number;
  inserted: number;
  letters: number;
  error?: string;
};

export type IngestImapOptions = {
  /** Gmail `newer_than:Xd` (default 14). */
  daysBack?: number;
  maxMessages?: number;
  /** Extra IMAP connect + processing attempts on transient network failures. */
  silentRetries?: number;
};

async function applyOrderUpsert(
  admin: SupabaseClient,
  userId: string,
  draft: ParsedImapOrder,
  result: CronUserResult
): Promise<void> {
  if (!draft.email_message_id) return;

  const status =
    isOrderLateForRefundStatus(draft.promised_delivery_time, draft.actual_delivery_time) ? 'pending_refund' : 'active';

  const now = new Date().toISOString();
  const baseRow = {
    user_id: userId,
    provider: draft.provider,
    order_id: draft.order_id,
    order_date: draft.order_date?.toISOString() ?? null,
    promised_delivery_time: draft.promised_delivery_time?.toISOString() ?? null,
    actual_delivery_time: draft.actual_delivery_time?.toISOString() ?? null,
    order_value_cents: draft.order_value_cents,
    currency: draft.currency,
    merchant_name: draft.merchant_name,
    email_message_id: draft.email_message_id,
    email_subject: draft.email_subject,
    email_from: draft.email_from,
    raw_email: draft.raw_email,
    updated_at: now,
    status,
  };

  if (draft.order_id) {
    const { data: existing, error: selErr } = await admin
      .from('orders')
      .select('id, promised_delivery_time, actual_delivery_time')
      .eq('user_id', userId)
      .eq('provider', draft.provider)
      .eq('order_id', draft.order_id)
      .maybeSingle();

    if (selErr) {
      console.warn('[imap-cron] orders select', userId, selErr.message);
      return;
    }

    if (existing?.id) {
      const { error: upErr } = await admin
        .from('orders')
        .update({
          ...baseRow,
          updated_at: now,
        })
        .eq('id', existing.id);

      if (upErr) {
        console.warn('[imap-cron] orders update', userId, upErr.message);
        return;
      }

      if (
        isDelayedOverMinutes(draft.promised_delivery_time, draft.actual_delivery_time, 15)
      ) {
        const letterRes = await triggerDelayLetterIfNeeded(admin, {
          id: existing.id,
          user_id: userId,
          provider: draft.provider,
          order_id: draft.order_id,
          promised_delivery_time: baseRow.promised_delivery_time,
          actual_delivery_time: baseRow.actual_delivery_time,
          order_value_cents: draft.order_value_cents,
          currency: draft.currency,
        });
        if (letterRes.triggered) result.letters += 1;
      }
      return;
    }
  }

  const { data: dup } = await admin
    .from('orders')
    .select('id')
    .eq('user_id', userId)
    .eq('email_message_id', draft.email_message_id)
    .maybeSingle();

  if (dup?.id) return;

  const { data: inserted, error: insErr } = await admin
    .from('orders')
    .insert(baseRow)
    .select('id')
    .single();

  if (insErr) {
    console.warn('[imap-cron] orders insert', userId, insErr.message);
    return;
  }

  result.inserted += 1;

  if (
    inserted?.id &&
    isDelayedOverMinutes(draft.promised_delivery_time, draft.actual_delivery_time, 15)
  ) {
    const letterRes = await triggerDelayLetterIfNeeded(admin, {
      id: inserted.id,
      user_id: userId,
      provider: draft.provider,
      order_id: draft.order_id,
      promised_delivery_time: baseRow.promised_delivery_time,
      actual_delivery_time: baseRow.actual_delivery_time,
      order_value_cents: draft.order_value_cents,
      currency: draft.currency,
    });
    if (letterRes.triggered) {
      result.letters += 1;
    }
  }
}

async function runIngestOnce(
  admin: SupabaseClient,
  row: ImapCredentialRow,
  opts?: IngestImapOptions
): Promise<CronUserResult> {
  const result: CronUserResult = {
    user_id: row.user_id,
    gmail_address: row.gmail_address,
    fetched: 0,
    inserted: 0,
    letters: 0,
  };

  let appPassword: string;
  try {
    appPassword = normalizeAppPassword(decryptAppPassword(row.encrypted_app_password));
  } catch (e) {
    result.error = e instanceof Error ? e.message : 'decrypt_failed';
    return result;
  }

  const daysBack = opts?.daysBack ?? 14;
  const maxMessages = opts?.maxMessages ?? IMAP_MAX_MESSAGES_DEFAULT;
  const gmailQuery = buildGmailImapRawQuery(daysBack);

  const client = createGmailImapClient(row.gmail_address, appPassword);

  try {
    await client.connect();
  } catch (e) {
    result.error = mapImapErrorToUserMessage(e);
    return result;
  }

  try {
    await client.mailboxOpen('INBOX');

    const uids = await client.search({ gmail: gmailQuery });
    if (!uids?.length) {
      return result;
    }

    const sorted = [...uids].sort((a, b) => Number(a) - Number(b));
    const slice = sorted.slice(-maxMessages);
    result.fetched = slice.length;

    if (slice.length === 0) {
      return result;
    }

    const seq = slice.join(',');
    const parsedRows: ParsedMessageRow[] = [];

    for await (const msg of client.fetch(seq, { source: true })) {
      if (!msg.source) continue;

      let parsed;
      try {
        parsed = await simpleParser(msg.source);
      } catch (e) {
        console.warn('[imap-cron] mailparser', row.user_id, e instanceof Error ? e.message : e);
        continue;
      }

      const draft = parseMailToOrder(parsed);
      const internalDate =
        parsed.date && !Number.isNaN(parsed.date.getTime()) ? parsed.date : new Date();

      parsedRows.push({ draft, internalDate });
    }

    const mergedMap = mergeParsedOrdersByMerchantId(parsedRows);

    for (const draft of mergedMap.values()) {
      if (draft.provider === 'other') continue;
      await applyOrderUpsert(admin, row.user_id, draft, result);
    }

    for (const r of parsedRows) {
      const oid = r.draft.order_id?.trim() ?? '';
      const mergeKey = oid.length >= 3 ? `${r.draft.provider}\0${oid}` : '';
      if (mergeKey && mergedMap.has(mergeKey)) continue;
      if (r.draft.provider === 'other' || !r.draft.email_message_id) continue;
      await applyOrderUpsert(admin, row.user_id, r.draft, result);
    }
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }

  return result;
}

export async function ingestImapForUser(
  admin: SupabaseClient,
  row: ImapCredentialRow,
  opts?: IngestImapOptions
): Promise<CronUserResult> {
  const retries = opts?.silentRetries ?? 2;
  let last: CronUserResult | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const r = await runIngestOnce(admin, row, opts);
    last = r;
    if (!r.error) return r;
    if (attempt < retries && isLikelyTransientImapFailure(r.error)) {
      await sleep(700 * (attempt + 1));
      continue;
    }
    return r;
  }

  return last ?? { user_id: row.user_id, gmail_address: row.gmail_address, fetched: 0, inserted: 0, letters: 0 };
}

/** Used right after mobile App Password save — wider cap + default 14-day window. */
export function ingestOptionsForMobileFirstSync(): IngestImapOptions {
  return {
    daysBack: 14,
    maxMessages: IMAP_MAX_MESSAGES_DEEP,
    silentRetries: 3,
  };
}

export async function ingestImapForAllUsers(admin: SupabaseClient): Promise<CronUserResult[]> {
  const { data: rows, error } = await admin
    .from('imap_app_credentials')
    .select('user_id, gmail_address, encrypted_app_password');

  if (error) {
    throw new Error(error.message);
  }

  const results: CronUserResult[] = [];
  for (const row of rows ?? []) {
    try {
      results.push(await ingestImapForUser(admin, row as ImapCredentialRow));
    } catch (e) {
      results.push({
        user_id: row.user_id,
        gmail_address: row.gmail_address,
        fetched: 0,
        inserted: 0,
        letters: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}
