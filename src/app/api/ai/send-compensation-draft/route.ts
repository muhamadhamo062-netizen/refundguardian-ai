import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/api';
import { normalizeAppPassword } from '@/lib/appPasswordNormalize';
import { decryptAppPassword } from '@/lib/server/gmailImapCrypto';
import { sendViaGmailSmtp } from '@/lib/server/sendViaGmailSmtp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PlatformKey = 'amazon' | 'uber_eats' | 'uber_rides' | 'doordash';

function asPlatform(v: unknown): PlatformKey | null {
  switch (v) {
    case 'amazon':
    case 'uber_eats':
    case 'uber_rides':
    case 'doordash':
      return v;
    default:
      return null;
  }
}

function platformSubject(p: PlatformKey): string {
  if (p === 'uber_eats') return 'Uber Eats';
  if (p === 'uber_rides') return 'Uber Rides';
  if (p === 'doordash') return 'DoorDash';
  return 'Amazon';
}

function envOverride(p: PlatformKey): string | undefined {
  const key = `COMPENSATION_DEFAULT_TO_${p.toUpperCase()}`;
  return process.env[key]?.trim() || undefined;
}

function defaultSupportEmail(p: PlatformKey): string | null {
  const o = envOverride(p);
  if (o) return o;
  switch (p) {
    case 'uber_eats':
    case 'uber_rides':
      return 'support@uber.com';
    case 'doordash':
      return 'help@doordash.com';
    case 'amazon':
      return null;
  }
}

function isValidEmail(v: string): boolean {
  return v.length >= 5 && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Missing Authorization' }, { status: 401 });
  }

  const supabase = createSupabaseClient(token);
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { platform?: unknown; draft?: unknown; to?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const platform = asPlatform(body.platform);
  if (!platform) {
    return NextResponse.json({ ok: false, error: 'platform is required' }, { status: 400 });
  }

  const draft = typeof body.draft === 'string' ? body.draft.trim() : '';
  if (!draft || draft.length > 20_000) {
    return NextResponse.json(
      { ok: false, error: 'draft is required (max 20000 characters)' },
      { status: 400 }
    );
  }

  let to = typeof body.to === 'string' ? body.to.trim() : '';
  if (!to) {
    const d = defaultSupportEmail(platform);
    if (!d) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Add a recipient email for this merchant (Amazon often uses in-app help).',
          code: 'recipient_required',
        },
        { status: 400 }
      );
    }
    to = d;
  }
  if (!isValidEmail(to)) {
    return NextResponse.json({ ok: false, error: 'Invalid recipient email' }, { status: 400 });
  }

  const { data: row, error: credErr } = await supabase
    .from('imap_app_credentials')
    .select('gmail_address, encrypted_app_password')
    .eq('user_id', user.id)
    .maybeSingle();

  if (credErr) {
    return NextResponse.json({ ok: false, error: credErr.message }, { status: 500 });
  }
  if (!row?.encrypted_app_password || !row.gmail_address) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Connect Gmail in the dashboard to send from your address.',
        code: 'gmail_not_connected',
      },
      { status: 400 }
    );
  }

  let appPassword: string;
  try {
    appPassword = normalizeAppPassword(decryptAppPassword(row.encrypted_app_password as string));
  } catch (e) {
    console.error('[api/ai/send-compensation-draft] decrypt', e);
    return NextResponse.json({ ok: false, error: 'Could not read stored credentials' }, { status: 500 });
  }

  const from = String(row.gmail_address).trim().toLowerCase();
  const subject = `Compensation request — ${platformSubject(platform)}`;

  try {
    await sendViaGmailSmtp({ from, to, subject, text: draft, appPassword });
  } catch (e) {
    console.error('[api/ai/send-compensation-draft] smtp', e);
    const msg = e instanceof Error ? e.message : 'Send failed';
    return NextResponse.json(
      { ok: false, error: `Email could not be sent: ${msg}` },
      { status: 502 }
    );
  }

  try {
    await supabase.from('compensation_events').insert({
      user_id: user.id,
      source: 'ai_priority_send_email',
      platform_key: platform,
      provider: platform === 'uber_rides' ? 'uber' : platform,
      auto_issue_type: platform === 'uber_rides' ? 'trip_delay' : 'late_delivery',
      optional_issue_types: [],
      message_preview: draft.slice(0, 500),
      metadata: { to, sent_via: 'gmail_smtp', subject },
    });
  } catch (e) {
    console.warn('[api/ai/send-compensation-draft] compensation_events', e);
  }

  return NextResponse.json({ ok: true, sent_to: to, from });
}
