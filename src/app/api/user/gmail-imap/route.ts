import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/api';
import { encryptAppPassword } from '@/lib/server/gmailImapCrypto';

export const dynamic = 'force-dynamic';

/**
 * Mobile path: store Gmail + App Password encrypted, keyed by the signed-in user (same user_id as extension flow).
 * Extension continues to POST orders to /api/orders etc. under the same auth user.
 */

function normalizeGmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Missing Authorization token' }, { status: 401 });
    }

    const supabase = createSupabaseClient(token);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: row, error } = await supabase
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
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
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
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Missing Authorization token' }, { status: 401 });
    }

    const supabase = createSupabaseClient(token);
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
    const appPassword = typeof body.appPassword === 'string' ? body.appPassword.trim() : '';

    if (!gmailAddress || !gmailAddress.includes('@')) {
      return NextResponse.json({ ok: false, error: 'Valid gmailAddress required' }, { status: 400 });
    }
    if (appPassword.length < 8) {
      return NextResponse.json({ ok: false, error: 'App Password looks invalid' }, { status: 400 });
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

    const now = new Date().toISOString();
    const { error: upErr } = await supabase.from('imap_app_credentials').upsert(
      {
        user_id: user.id,
        gmail_address: gmailAddress,
        encrypted_app_password: ciphertext,
        updated_at: now,
        last_scan_error: null,
      },
      { onConflict: 'user_id' }
    );

    if (upErr) {
      if (upErr.message?.includes('does not exist') || upErr.code === '42P01') {
        return NextResponse.json(
          {
            ok: false,
            error: 'Database table imap_app_credentials missing. Apply migration 015.',
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/user/gmail-imap POST]', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Missing Authorization token' }, { status: 401 });
    }

    const supabase = createSupabaseClient(token);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { error: delErr } = await supabase.from('imap_app_credentials').delete().eq('user_id', user.id);

    if (delErr) {
      return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/user/gmail-imap DELETE]', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
