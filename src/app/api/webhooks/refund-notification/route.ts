import { NextResponse } from 'next/server';

import { trySendRefundSuccessNotificationEmail } from '@/lib/email/processRefundSuccessNotification';
import { createServiceRoleClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorize(request: Request): boolean {
  const expected = process.env.REFUND_NOTIFICATION_WEBHOOK_SECRET?.trim();
  if (!expected) return false;
  const h = request.headers.get('x-refyndra-webhook-secret')?.trim();
  if (h && h === expected) return true;
  const auth = request.headers.get('authorization');
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return !!bearer && bearer === expected;
}

type DbWebhookBody = {
  type?: string;
  eventType?: string;
  table?: string;
  record?: { id?: string; type?: string; user_id?: string; data?: Record<string, unknown> | null };
};

/**
 * Supabase Database Webhook (notifications INSERT) → send Golden Email via Resend immediately.
 * Configure in Supabase: Database → Webhooks → URL `POST /api/webhooks/refund-notification`
 * with header `x-refyndra-webhook-secret: <REFUND_NOTIFICATION_WEBHOOK_SECRET>`.
 */
export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as DbWebhookBody;
  const record = b.record;
  const table = (b.table ?? '').toLowerCase();
  const evt = String(b.type ?? b.eventType ?? '').toLowerCase();

  if (!record?.id || !record.user_id) {
    return NextResponse.json({ ok: false, error: 'Missing record id or user_id' }, { status: 400 });
  }

  if (table && table !== 'notifications') {
    return NextResponse.json({ ok: true, ignored: true, reason: 'wrong_table' });
  }
  if (evt && evt !== 'insert') {
    return NextResponse.json({ ok: true, ignored: true, reason: 'not_insert' });
  }
  if (record.type !== 'refund_success_upgrade') {
    return NextResponse.json({ ok: true, ignored: true, reason: 'wrong_type' });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Service role not configured' }, { status: 503 });
  }

  const { data: row, error } = await admin
    .from('notifications')
    .select('id, user_id, data')
    .eq('id', record.id)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'Notification not found' },
      { status: error ? 500 : 404 }
    );
  }

  const result = await trySendRefundSuccessNotificationEmail(admin, {
    id: row.id as string,
    user_id: row.user_id as string,
    data: (row.data as Record<string, unknown> | null) ?? null,
  });

  return NextResponse.json({
    ok: true,
    outcome: result.outcome,
    detail: result.detail,
  });
}
