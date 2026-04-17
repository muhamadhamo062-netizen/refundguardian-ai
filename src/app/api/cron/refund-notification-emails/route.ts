import { NextResponse } from 'next/server';

import {
  refundNotificationNeedsEmail,
  trySendRefundSuccessNotificationEmail,
  type RefundSuccessNotifRow,
} from '@/lib/email/processRefundSuccessNotification';
import { createServiceRoleClient } from '@/lib/supabase/admin';

/** Backup sender when `/api/webhooks/refund-notification` is not wired yet. */
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

  for (const n of (rows ?? []) as RefundSuccessNotifRow[]) {
    if (!refundNotificationNeedsEmail(n.data)) {
      skipped += 1;
      continue;
    }

    const r = await trySendRefundSuccessNotificationEmail(admin, n);
    if (r.outcome === 'sent') {
      sent += 1;
    } else if (r.outcome === 'skipped') {
      skipped += 1;
    } else if (r.detail) {
      errors.push(r.detail);
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, errors: errors.slice(0, 5) });
}
