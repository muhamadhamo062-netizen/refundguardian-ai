import { NextResponse } from 'next/server';

import { mergeFromNotificationData, sendRefundSuccessEmail } from '@/lib/email/sendRefundSuccessEmail';
import { createServiceRoleClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

function authorize(request: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;
  const h = request.headers.get('x-cron-secret')?.trim();
  if (h && h === expected) return true;
  const auth = request.headers.get('authorization');
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return !!bearer && bearer === expected;
}

type NotifRow = {
  id: string;
  user_id: string;
  data: Record<string, unknown> | null;
};

function needsEmail(data: Record<string, unknown> | null): boolean {
  if (!data) return true;
  const sent = data.email_sent;
  return sent !== true && sent !== 'true';
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Service role not configured' }, { status: 503 });
  }

  const { data: rows, error } = await admin
    .from('notifications')
    .select('id, user_id, data')
    .eq('type', 'refund_success_upgrade')
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    console.error('[cron/refund-notification-emails]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const n of (rows ?? []) as NotifRow[]) {
    if (!needsEmail(n.data)) {
      skipped += 1;
      continue;
    }

    const { data: profile } = await admin.from('users').select('email').eq('id', n.user_id).maybeSingle();
    const email = typeof profile?.email === 'string' ? profile.email.trim() : '';
    if (!email) {
      errors.push(`no email for user ${n.user_id}`);
      skipped += 1;
      continue;
    }

    const merge = mergeFromNotificationData(n.data);
    if (!merge) {
      errors.push(`bad data for notification ${n.id}`);
      skipped += 1;
      continue;
    }

    const result = await sendRefundSuccessEmail({ to: email, merge });
    if (!result.ok) {
      console.warn('[cron/refund-notification-emails]', n.id, result.error);
      errors.push(result.error);
      continue;
    }

    const nextData = {
      ...(n.data ?? {}),
      email_sent: true,
      email_sent_at: new Date().toISOString(),
    };
    const { error: upErr } = await admin.from('notifications').update({ data: nextData }).eq('id', n.id);
    if (upErr) {
      errors.push(upErr.message);
    } else {
      sent += 1;
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, errors: errors.slice(0, 5) });
}
