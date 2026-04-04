import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type DbStatus = 'connected' | 'missing_table' | 'error';
type StorageStatus = 'ok' | 'missing_env';
type ExtensionSyncEventsStatus = 'ok' | 'missing_table' | 'error' | 'skipped';
type ImapCredentialsStatus = 'ok' | 'missing_table' | 'error' | 'skipped';

/**
 * System diagnostics. Uses service role when set (bypasses RLS for table existence check).
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const cronSecret = process.env.CRON_SECRET?.trim();
  const imapEncKey = process.env.GMAIL_IMAP_ENCRYPTION_KEY?.trim();

  let db: DbStatus = 'error';
  const storage: StorageStatus = url && anonKey ? 'ok' : 'missing_env';
  let extension_sync_events: ExtensionSyncEventsStatus = 'skipped';
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
    } else {
      const supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await supabase.from('orders').select('id').limit(1);
      if (!error) {
        db = 'connected';
      } else {
        const msg = (error.message || '').toLowerCase();
        const code = (error as { code?: string }).code;
        if (
          code === '42P01' ||
          (msg.includes('does not exist') && msg.includes('orders')) ||
          (msg.includes('schema cache') && msg.includes('orders'))
        ) {
          db = 'missing_table';
        } else {
          db = 'error';
        }
      }

      if (db === 'connected') {
        const extSync = await supabase.from('extension_sync_events').select('id').limit(1);
        if (!extSync.error) {
          extension_sync_events = 'ok';
        } else {
          const msg = (extSync.error.message || '').toLowerCase();
          const code = (extSync.error as { code?: string }).code;
          if (
            code === '42P01' ||
            (msg.includes('does not exist') && msg.includes('extension_sync_events')) ||
            (msg.includes('schema cache') && msg.includes('extension_sync_events'))
          ) {
            extension_sync_events = 'missing_table';
          } else {
            extension_sync_events = 'error';
          }
        }
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
  } catch {
    db = 'error';
  }

  const extension_sync: 'ok' | 'degraded' =
    db === 'connected' && storage === 'ok' ? 'ok' : 'degraded';

  /** Healthy DB only — env gaps surface via `storage`, not `ok` */
  const ok = db === 'connected';

  return NextResponse.json({
    ok,
    db,
    storage,
    extension_sync,
    extension_sync_events,
    imap_app_credentials,
    imap_env,
  });
}
