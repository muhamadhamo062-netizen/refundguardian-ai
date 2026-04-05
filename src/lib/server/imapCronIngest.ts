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
};

export type CronUserResult = {
  user_id: string;
  gmail_address: string;
  fetched: number;
  inserted: number;
  letters: number;
  error?: string;
};

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
      results.push(
        await ingestImapForUser(admin, row as ImapCredentialRow)
      );
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
