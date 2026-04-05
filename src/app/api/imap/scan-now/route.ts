import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/api';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { ingestImapForUser } from '@/lib/server/imapCronIngest';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function requireEnv(): { ok: true } | { ok: false; error: string } {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    return { ok: false, error: 'Supabase env vars missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)' };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY not configured on server' };
  }
  if (!process.env.GMAIL_IMAP_ENCRYPTION_KEY?.trim()) {
    return { ok: false, error: 'GMAIL_IMAP_ENCRYPTION_KEY not configured on server' };
  }
  return { ok: true };
}

/**
 * Manual IMAP scan for the currently authenticated user.
 * Mobile flow: user connects Gmail → clicks "Scan Now" → orders appear without waiting for cron.
 */
export async function POST(request: Request) {
  const envOk = requireEnv();
  if (!envOk.ok) {
    return NextResponse.json({ success: false, error: envOk.error }, { status: 503 });
  }

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return NextResponse.json({ success: false, error: 'Missing Authorization token' }, { status: 401 });
  }

  const supabase = createSupabaseClient(token);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: 'Server database client not configured (SUPABASE_SERVICE_ROLE_KEY)' },
      { status: 503 }
    );
  }

  const { data: creds, error: credsErr } = await admin
    .from('imap_app_credentials')
    .select('user_id, gmail_address, encrypted_app_password')
    .eq('user_id', user.id)
    .maybeSingle();

  if (credsErr) {
    const code = (credsErr as { code?: string }).code;
    const msg = credsErr.message || '';
    if (code === '42P01' || msg.toLowerCase().includes('imap_app_credentials')) {
      return NextResponse.json(
        { success: false, error: 'IMAP credentials table missing. Apply migration 015/017.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: credsErr.message }, { status: 500 });
  }

  if (!creds) {
    return NextResponse.json(
      { success: false, error: 'No Gmail connection saved yet. Connect Gmail first.' },
      { status: 400 }
    );
  }

  const startedAt = new Date().toISOString();
  try {
    const result = await ingestImapForUser(admin, creds);
    const now = new Date().toISOString();
    await admin
      .from('imap_app_credentials')
      .update({
        last_scan_at: now,
        last_scan_inserted: result.inserted,
        last_scan_error: result.error ?? null,
      })
      .eq('user_id', user.id);

    if (result.error) {
      console.warn('[api/imap/scan-now] user', user.id, 'error', result.error);
      return NextResponse.json(
        { success: false, error: 'Gmail connection failed', detail: result.error, ordersFound: result.inserted },
        { status: 502 }
      );
    }

    console.log('[api/imap/scan-now] user', user.id, 'inserted', result.inserted, 'fetched', result.fetched);
    return NextResponse.json({ success: true, ordersFound: result.inserted, scannedAt: now, startedAt });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'scan_failed';
    console.error('[api/imap/scan-now]', user.id, errMsg);
    const now = new Date().toISOString();
    await admin
      .from('imap_app_credentials')
      .update({ last_scan_at: now, last_scan_inserted: 0, last_scan_error: errMsg })
      .eq('user_id', user.id);
    return NextResponse.json({ success: false, error: 'Scan failed', detail: errMsg }, { status: 500 });
  }
}

