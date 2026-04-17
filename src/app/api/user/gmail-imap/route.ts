import { NextResponse } from 'next/server';
import { normalizeAppPassword } from '@/lib/appPasswordNormalize';
import { createSupabaseClient } from '@/lib/supabase/api';
import { createClient } from '@/lib/supabase/server';
import { encryptAppPassword } from '@/lib/server/gmailImapCrypto';
import { ingestImapForUser, ingestOptionsForMobileFirstSync } from '@/lib/server/imapCronIngest';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { unstable_noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Gmail + App Password → `imap_app_credentials`. Auth via session; DB writes via service role only. */

function normalizeGmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function GET(request: Request) {
  unstable_noStore();
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    const supabase = token ? createSupabaseClient(token) : createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const service = createServiceRoleClient();
    const dbRead = service ?? supabase;
    const { data: row, error } = await dbRead
      .from('imap_app_credentials')
      .select('gmail_address, updated_at, last_scan_at, last_scan_inserted, last_scan_error')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({
          ok: false,
          error: 'Database table imap_app_credentials missing. Apply migration 015_imap_app_credentials.sql.',
        });
      }
      console.error('[api/user/gmail-imap GET]', error);
      return NextResponse.json(
        { ok: true, connected: false, gmail_address: null, last_scan_at: null, last_scan_inserted: null, last_scan_error: null },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json({
      ok: true,
      connected: !!row,
      gmail_address: row?.gmail_address ?? null,
      updated_at: row?.updated_at ?? null,
      last_scan_at: (row as { last_scan_at?: string | null } | null)?.last_scan_at ?? null,
      last_scan_inserted:
        typeof (row as { last_scan_inserted?: number } | null)?.last_scan_inserted === 'number'
          ? (row as { last_scan_inserted: number }).last_scan_inserted
          : null,
      last_scan_error: (row as { last_scan_error?: string | null } | null)?.last_scan_error ?? null,
    });
  } catch (e) {
    console.error('[api/user/gmail-imap GET]', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  unstable_noStore();
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    const supabase = token ? createSupabaseClient(token) : createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    let body: { gmailAddress?: string; appPassword?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const gmailAddress = typeof body.gmailAddress === 'string' ? normalizeGmail(body.gmailAddress) : '';
    const appPasswordRaw = typeof body.appPassword === 'string' ? body.appPassword : '';
    const appPassword = normalizeAppPassword(appPasswordRaw);

    if (!gmailAddress) {
      return NextResponse.json({ ok: false, error: 'Enter a Gmail address.' }, { status: 400 });
    }

    if (appPassword.length !== 16) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Google App Passwords are exactly 16 characters after removing spaces. Regenerate one in your Google Account and paste it without extra characters.',
        },
        { status: 400 }
      );
    }

    let ciphertext: string;
    try {
      ciphertext = encryptAppPassword(appPassword);
    } catch (encErr) {
      console.error('[api/user/gmail-imap POST] encrypt', encErr);
      return NextResponse.json(
        {
          ok: false,
          error:
            encErr instanceof Error
              ? encErr.message
              : 'Encryption not configured (set GMAIL_IMAP_ENCRYPTION_KEY on the server).',
        },
        { status: 500 }
      );
    }

    const encrypted_app_password = ciphertext;
    const now = new Date().toISOString();

    const service = createServiceRoleClient();
    if (!service) {
      console.error('[api/user/gmail-imap POST] SUPABASE_SERVICE_ROLE_KEY missing — cannot persist imap_app_credentials.');
      return NextResponse.json(
        {
          ok: false,
          connected: false,
          error:
            'Server cannot save Gmail credentials (missing SUPABASE_SERVICE_ROLE_KEY). Add it to .env.local and restart the dev server.',
        },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    try {
      const payload = {
        user_id: user.id,
        gmail_address: gmailAddress,
        encrypted_app_password,
        updated_at: now,
        last_scan_error: null as string | null,
      };

      // Prefer update-then-insert: works even when the table has no UNIQUE/PK on user_id
      // (Postgres 42P10 on upsert onConflict).
      const { data: existing, error: selErr } = await service
        .from('imap_app_credentials')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (selErr) {
        console.error('[api/user/gmail-imap POST] select existing', selErr);
        return NextResponse.json(
          { ok: false, connected: false, error: selErr.message },
          { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      if (existing) {
        const { error: updErr } = await service
          .from('imap_app_credentials')
          .update({
            gmail_address: payload.gmail_address,
            encrypted_app_password: payload.encrypted_app_password,
            updated_at: payload.updated_at,
            last_scan_error: payload.last_scan_error,
          })
          .eq('user_id', user.id);
        if (updErr) {
          console.error('[api/user/gmail-imap POST] update', updErr);
          return NextResponse.json(
            { ok: false, connected: false, error: updErr.message },
            { status: 500, headers: { 'Cache-Control': 'no-store' } }
          );
        }
      } else {
        const { error: insErr } = await service.from('imap_app_credentials').insert(payload);
        if (insErr) {
          console.error('[api/user/gmail-imap POST] insert', insErr);
          return NextResponse.json(
            { ok: false, connected: false, error: insErr.message },
            { status: 500, headers: { 'Cache-Control': 'no-store' } }
          );
        }
      }

      void ingestImapForUser(
        service,
        {
          user_id: user.id,
          gmail_address: gmailAddress,
          encrypted_app_password,
        },
        ingestOptionsForMobileFirstSync()
      ).catch((err) => console.error('[api/user/gmail-imap POST] background ingest', err));

      return NextResponse.json(
        {
          success: true,
          ok: true,
          connected: true,
          gmail_address: gmailAddress,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    } catch (persistErr) {
      console.error('[api/user/gmail-imap POST] persist exception', persistErr);
      return NextResponse.json(
        {
          ok: false,
          connected: false,
          error: persistErr instanceof Error ? persistErr.message : 'Save failed.',
        },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }
  } catch (e) {
    console.error('[api/user/gmail-imap POST]', e);
    return NextResponse.json(
      {
        ok: false,
        connected: false,
        error: e instanceof Error ? e.message : 'Server error',
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function DELETE(request: Request) {
  unstable_noStore();
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    const supabase = token ? createSupabaseClient(token) : createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const service = createServiceRoleClient();
    if (service) {
      try {
        const { error: delErr } = await service.from('imap_app_credentials').delete().eq('user_id', user.id);
        if (delErr) console.error('[api/user/gmail-imap DELETE]', delErr);
      } catch (e) {
        console.error('[api/user/gmail-imap DELETE] exception', e);
      }
    } else {
      console.error('[api/user/gmail-imap DELETE] SUPABASE_SERVICE_ROLE_KEY missing');
    }

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[api/user/gmail-imap DELETE]', e);
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
