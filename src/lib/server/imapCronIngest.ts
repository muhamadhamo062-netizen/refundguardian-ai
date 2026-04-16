/**
 * Background IMAP ingestion: connect per user (Gmail + App Password),
 * search transactional senders, parse mail → insert `orders`, then delay + OpenAI path.
 */

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import type { SupabaseClient } from '@supabase/supabase-js';

import { decryptAppPassword } from '@/lib/server/gmailImapCrypto';
import { GMAIL_IMAP_RAW_QUERY, IMAP_MAX_MESSAGES_PER_USER } from '@/lib/server/imapAllowedSenders';
import { isDelayedOverMinutes, parseMailToOrder } from '@/lib/server/parseImapOrderEmail';
import { triggerDelayLetterIfNeeded } from '@/lib/server/imapDelayLetter';

export type ImapCredentialRow = {
  user_id: string;
  gmail_address: string;
  encrypted_app_password: string;
  auto_send_enabled?: boolean | null;
  auto_send_recipient?: string | null;
  auto_send_from_name?: string | null;
};

export type CronUserResult = {
  user_id: string;
  gmail_address: string;
  fetched: number;
  inserted: number;
  letters: number;
  error?: string;
};

type IngestAllOptions = {
  /** Max users to scan in this invocation (default: unlimited). */
  maxUsers?: number;
  /** DB page size for selecting creds (default: 25). */
  pageSize?: number;
  /** Per-user IMAP ingest timeout (default: 45s). */
  perUserTimeoutMs?: number;
  /** Hard deadline for the whole run (default: 270s). */
  deadlineMs?: number;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) return p;
  return Promise.race([
    p,
    new Promise<T>((_, rej) => {
      const t = setTimeout(() => rej(new Error(`${label}_timeout`)), ms);
      // Avoid keeping the event loop alive.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t as any).unref?.();
    }),
  ]);
}

function computeBackoffMs(streak: number): number {
  // 15m, 30m, 60m, 120m, ... capped at 6h
  const base = 15 * 60 * 1000;
  const cap = 6 * 60 * 60 * 1000;
  const pow = Math.min(10, Math.max(0, streak));
  return Math.min(cap, base * Math.pow(2, Math.max(0, pow - 1)));
}

export async function ingestImapForUser(
  admin: SupabaseClient,
  row: ImapCredentialRow
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
    appPassword = decryptAppPassword(row.encrypted_app_password);
  } catch (e) {
    result.error = e instanceof Error ? e.message : 'decrypt_failed';
    return result;
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: row.gmail_address, pass: appPassword },
    logger: false,
  });

  try {
    await client.connect();
  } catch (e) {
    result.error = e instanceof Error ? e.message : 'imap_connect_failed';
    return result;
  }
  try {
    await client.mailboxOpen('INBOX');

    const uids = await client.search({ gmail: GMAIL_IMAP_RAW_QUERY });
    if (!uids?.length) {
      return result;
    }

    const sorted = [...uids].sort((a, b) => Number(a) - Number(b));
    const slice = sorted.slice(-IMAP_MAX_MESSAGES_PER_USER);
    result.fetched = slice.length;

    if (slice.length === 0) {
      return result;
    }

    const seq = slice.join(',');

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
      if (draft.provider === 'other') continue;
      if (!draft.email_message_id) continue;

      const { data: dup } = await admin
        .from('orders')
        .select('id')
        .eq('user_id', row.user_id)
        .eq('email_message_id', draft.email_message_id)
        .maybeSingle();

      if (dup?.id) continue;

      const now = new Date().toISOString();
      const insertRow = {
        user_id: row.user_id,
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
      };

      const { data: inserted, error: insErr } = await admin
        .from('orders')
        .insert(insertRow)
        .select('id')
        .single();

      if (insErr) {
        console.warn('[imap-cron] orders insert', row.user_id, insErr.message);
        continue;
      }

      result.inserted += 1;

      if (
        inserted?.id &&
        isDelayedOverMinutes(draft.promised_delivery_time, draft.actual_delivery_time, 15)
      ) {
        const letterRes = await triggerDelayLetterIfNeeded(admin, {
          id: inserted.id,
          user_id: row.user_id,
          provider: draft.provider,
          order_id: draft.order_id,
          promised_delivery_time: insertRow.promised_delivery_time,
          actual_delivery_time: insertRow.actual_delivery_time,
          order_value_cents: draft.order_value_cents,
          currency: draft.currency,
          merchant_name: draft.merchant_name,
          smtp: {
            gmail_address: row.gmail_address,
            app_password: appPassword,
            auto_send_enabled: row.auto_send_enabled ?? false,
            auto_send_recipient: row.auto_send_recipient ?? null,
            auto_send_from_name: row.auto_send_from_name ?? null,
          },
        });
        if (letterRes.triggered) {
          result.letters += 1;
        }
      }
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

export async function ingestImapForAllUsers(
  admin: SupabaseClient,
  options: IngestAllOptions = {}
): Promise<CronUserResult[]> {
  const startedAt = Date.now();
  const maxUsers = typeof options.maxUsers === 'number' && options.maxUsers > 0 ? options.maxUsers : Infinity;
  const pageSize = typeof options.pageSize === 'number' && options.pageSize > 0 ? Math.min(200, options.pageSize) : 25;
  const perUserTimeoutMs =
    typeof options.perUserTimeoutMs === 'number' && options.perUserTimeoutMs > 0
      ? options.perUserTimeoutMs
      : 45_000;
  const deadlineMs =
    typeof options.deadlineMs === 'number' && options.deadlineMs > 0 ? options.deadlineMs : 270_000;

  const results: CronUserResult[] = [];
  let offset = 0;

  while (results.length < maxUsers) {
    if (Date.now() - startedAt > deadlineMs) break;

    const { data: rows, error } = await admin
      .from('imap_app_credentials')
      .select(
        'user_id, gmail_address, encrypted_app_password, auto_send_enabled, auto_send_recipient, auto_send_from_name, next_scan_after, scan_error_streak'
      )
      .order('updated_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    if (!rows?.length) break;

    offset += rows.length;

    for (const raw of rows) {
      if (results.length >= maxUsers) break;
      if (Date.now() - startedAt > deadlineMs) break;

      const row = raw as ImapCredentialRow & {
        next_scan_after?: string | null;
        scan_error_streak?: number | null;
      };

      const nextScanAfter = typeof row.next_scan_after === 'string' ? new Date(row.next_scan_after) : null;
      if (nextScanAfter && !Number.isNaN(nextScanAfter.getTime()) && nextScanAfter.getTime() > Date.now()) {
        continue;
      }

      // A small pause avoids a thundering herd against Gmail when many users connect at once.
      await sleep(75);

      let res: CronUserResult;
      const nowIso = new Date().toISOString();
      try {
        res = await withTimeout(
          ingestImapForUser(admin, row),
          perUserTimeoutMs,
          'imap_user_ingest'
        );
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        res = {
          user_id: row.user_id,
          gmail_address: row.gmail_address,
          fetched: 0,
          inserted: 0,
          letters: 0,
          error: errMsg,
        };
      }

      results.push(res);

      const prevStreak = typeof row.scan_error_streak === 'number' ? row.scan_error_streak : 0;
      const nextStreak = res.error ? prevStreak + 1 : 0;
      const nextScanAfterIso = res.error
        ? new Date(Date.now() + computeBackoffMs(nextStreak)).toISOString()
        : null;

      await admin
        .from('imap_app_credentials')
        .update({
          last_scan_at: nowIso,
          last_scan_inserted: res.inserted,
          last_scan_error: res.error ?? null,
          updated_at: nowIso,
          scan_error_streak: nextStreak,
          next_scan_after: nextScanAfterIso,
        })
        .eq('user_id', row.user_id);
    }
  }

  return results;
}
