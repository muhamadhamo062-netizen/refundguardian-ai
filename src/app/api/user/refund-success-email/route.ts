import { NextResponse } from 'next/server';

import {
  refundNotificationNeedsEmail,
  trySendRefundSuccessNotificationEmail,
  type RefundSuccessNotifRow,
} from '@/lib/email/processRefundSuccessNotification';
import { createSupabaseClient } from '@/lib/supabase/api';
import { createServiceRoleClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Sends pending `refund_success_upgrade` emails for the signed-in user (near-immediate vs cron-only).
 * Idempotent: respects `data.email_sent` on the notification row.
 */
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

    const admin = createServiceRoleClient();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Service role not configured', skipped: true }, { status: 503 });
    }

    const { data: rows, error } = await admin
      .from('notifications')
      .select('id, user_id, data')
      .eq('user_id', user.id)
      .eq('type', 'refund_success_upgrade')
      .order('created_at', { ascending: true })
      .limit(25);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const n of (rows ?? []) as RefundSuccessNotifRow[]) {
      if (!refundNotificationNeedsEmail(n.data)) continue;

      const r = await trySendRefundSuccessNotificationEmail(admin, n);
      if (r.outcome === 'sent') {
        sent += 1;
      } else if (r.detail) {
        errors.push(r.detail);
      }
    }

    return NextResponse.json({ ok: true, sent, errors: errors.slice(0, 3) });
  } catch (e) {
    console.error('[api/user/refund-success-email]', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
