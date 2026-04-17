import type { SupabaseClient } from '@supabase/supabase-js';

import { mergeFromNotificationData, sendRefundSuccessEmail } from '@/lib/email/sendRefundSuccessEmail';

export type RefundSuccessNotifRow = {
  id: string;
  user_id: string;
  data: Record<string, unknown> | null;
};

export function refundNotificationNeedsEmail(data: Record<string, unknown> | null): boolean {
  if (!data) return true;
  const sent = data.email_sent;
  return sent !== true && sent !== 'true';
}

/**
 * Sends one Golden Email for a `refund_success_upgrade` row when `data.email_sent` is not set.
 * Updates the notification row on success. Safe for concurrent cron + webhook (duplicate sends are rare).
 */
export async function trySendRefundSuccessNotificationEmail(
  admin: SupabaseClient,
  n: RefundSuccessNotifRow
): Promise<{ outcome: 'sent' | 'skipped' | 'error'; detail?: string }> {
  if (!refundNotificationNeedsEmail(n.data)) {
    return { outcome: 'skipped' };
  }

  const { data: profile } = await admin.from('users').select('email').eq('id', n.user_id).maybeSingle();
  const email = typeof profile?.email === 'string' ? profile.email.trim() : '';
  if (!email) {
    return { outcome: 'skipped', detail: 'no email for user' };
  }

  const merge = mergeFromNotificationData(n.data);
  if (!merge) {
    return { outcome: 'error', detail: 'bad notification payload' };
  }

  const result = await sendRefundSuccessEmail({ to: email, merge });
  if (!result.ok) {
    return { outcome: 'error', detail: result.error };
  }

  const nextData = {
    ...(n.data ?? {}),
    email_sent: true,
    email_sent_at: new Date().toISOString(),
  };
  const { error: upErr } = await admin.from('notifications').update({ data: nextData }).eq('id', n.id);
  if (upErr) {
    return { outcome: 'error', detail: upErr.message };
  }
  return { outcome: 'sent' };
}
