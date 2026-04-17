import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type DbStatus = 'connected' | 'missing_table' | 'error';
type StorageStatus = 'ok' | 'missing_env';
type ImapCredentialsStatus = 'ok' | 'missing_table' | 'error' | 'skipped';

/** Short hint for dashboard (no secrets). */
type DbHint =
  | 'ok'
  | 'missing_env'
  | 'missing_orders_table'
  | 'invalid_or_unauthorized_key'
  | 'rls_blocks_anon_add_service_role'
  | 'unknown';

function sanitizeErr(msg: string): string {
  return msg.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function classifyOrdersError(
  error: { message?: string; code?: string; details?: string },
  usingServiceRole: boolean
): { db: DbStatus; hint: DbHint; detail: string } {
  const msg = (error.message || '').toLowerCase();
  const code = (error as { code?: string }).code;
  const detail = sanitizeErr(error.message || String(code || 'unknown'));

  if (
    code === '42703' ||
    (msg.includes('column') && msg.includes('does not exist'))
  ) {
    return { db: 'error', hint: 'unknown', detail };
  }

  if (
    code === '42P01' ||
    (msg.includes('does not exist') && msg.includes('orders')) ||
    (msg.includes('schema cache') && msg.includes('orders'))
  ) {
    return { db: 'missing_table', hint: 'missing_orders_table', detail };
  }

  if (
    msg.includes('invalid api key') ||
    msg.includes('jwt') ||
    code === 'PGRST301' ||
    msg.includes('invalid value for header') ||
    msg.includes('unauthorized')
  ) {
    return { db: 'error', hint: 'invalid_or_unauthorized_key', detail };
  }

  if (
    !usingServiceRole &&
    (msg.includes('permission denied') ||
      msg.includes('rls') ||
      code === '42501' ||
      msg.includes('row-level security') ||
      msg.includes('policy'))
  ) {
    return { db: 'error', hint: 'rls_blocks_anon_add_service_role', detail };
  }

  return { db: 'error', hint: 'unknown', detail };
}

/**
 * System diagnostics. Uses service role when set (bypasses RLS for table existence check).
 * Without service role, anon key cannot SELECT `orders` under typical RLS — health will show a clear hint.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const cronSecret = process.env.CRON_SECRET?.trim();
  const imapEncKey = process.env.GMAIL_IMAP_ENCRYPTION_KEY?.trim();

  let db: DbStatus = 'error';
  let db_hint: DbHint = 'unknown';
  let db_detail = '';
  const storage: StorageStatus = url && anonKey ? 'ok' : 'missing_env';
  let imap_app_credentials: ImapCredentialsStatus = 'skipped';

  const imap_env = {
    encryption_key: imapEncKey ? 'ok' : 'missing',
    cron_secret: cronSecret ? 'ok' : 'missing',
    service_role: serviceKey ? 'ok' : 'missing',
  } as const;

  try {
    const key = serviceKey || anonKey;
    if (!url || !key) {
      db = 'error';
      db_hint = 'missing_env';
    } else {
      const supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await supabase.from('orders').select('id').limit(1);
      if (!error) {
        db = 'connected';
        db_hint = 'ok';
      } else {
        const c = classifyOrdersError(error, !!serviceKey);
        db = c.db;
        db_hint = c.hint;
        db_detail = c.detail;
      }

      if (db === 'connected') {
        const imapCreds = await supabase.from('imap_app_credentials').select('user_id').limit(1);
        if (!imapCreds.error) {
          imap_app_credentials = 'ok';
        } else {
          const msg = (imapCreds.error.message || '').toLowerCase();
          const code = (imapCreds.error as { code?: string }).code;
          if (
            code === '42P01' ||
            (msg.includes('does not exist') && msg.includes('imap_app_credentials')) ||
            (msg.includes('schema cache') && msg.includes('imap_app_credentials'))
          ) {
            imap_app_credentials = 'missing_table';
          } else {
            imap_app_credentials = 'error';
          }
        }
      }
    }
  } catch (e) {
    db = 'error';
    db_hint = 'unknown';
    db_detail = e instanceof Error ? sanitizeErr(e.message) : 'exception';
  }

  const ok = db === 'connected';

  return NextResponse.json({
    ok,
    db,
    db_hint,
    db_detail,
    storage,
    imap_app_credentials,
    imap_env,
  });
}
