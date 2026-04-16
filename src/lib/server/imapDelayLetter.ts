/**
 * When IMAP-parsed order has promised vs actual delivery and delay > 15 minutes:
 * generate a compensation letter via OpenAI (if configured) and log `detected_refunds`.
 * Mirrors `/api/compensation` `action: generate` behavior using the service role.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { generateStructuredComplaint } from '@/lib/ai/complaintGenerator';
import type { RefundPlatform } from '@/lib/refundPriorityEngine';
import { sendViaGmailSmtp } from '@/lib/server/gmailSmtpSender';

const DELAY_THRESHOLD_MIN = 15;

export type DelayLetterOrder = {
  id: string;
  user_id: string;
  provider: string;
  order_id: string | null;
  promised_delivery_time: string | null;
  actual_delivery_time: string | null;
  order_value_cents: number | null;
  currency: string | null;
  merchant_name?: string | null;
  smtp?: {
    gmail_address: string;
    app_password: string;
    auto_send_enabled: boolean;
    auto_send_recipient: string | null;
    auto_send_from_name: string | null;
  };
};

function asRefundPlatform(provider: string): RefundPlatform {
  const p = provider.toLowerCase();
  if (p.includes('doordash')) return 'doordash';
  if (p.includes('eats')) return 'uber_eats';
  if (p.includes('uber')) return 'uber_rides';
  return 'amazon';
}

export async function triggerDelayLetterIfNeeded(
  admin: SupabaseClient,
  order: DelayLetterOrder
): Promise<{ triggered: boolean; skipped?: string; delay_minutes?: number }> {
  const promised = order.promised_delivery_time ? new Date(order.promised_delivery_time) : null;
  const actual = order.actual_delivery_time ? new Date(order.actual_delivery_time) : null;
  if (!promised || !actual || Number.isNaN(promised.getTime()) || Number.isNaN(actual.getTime())) {
    return { triggered: false, skipped: 'missing_times' };
  }

  const delayMs = actual.getTime() - promised.getTime();
  if (delayMs <= DELAY_THRESHOLD_MIN * 60 * 1000) {
    return { triggered: false, skipped: 'under_threshold' };
  }

  const delayMinutes = Math.round(delayMs / 60000);

  const { data: existingRefund, error: exErr } = await admin
    .from('detected_refunds')
    .select('id')
    .eq('order_id', order.id)
    .maybeSingle();

  if (exErr) {
    return { triggered: false, skipped: exErr.message };
  }
  if (existingRefund?.id) {
    return { triggered: false, skipped: 'already_logged' };
  }

  let letter: string | null = null;
  if (process.env.OPENAI_API_KEY?.trim()) {
    try {
      letter = await generateStructuredComplaint({
        platform: asRefundPlatform(order.provider),
        issues: [
          `Late delivery delay: approximately ${delayMinutes} minutes.`,
          order.order_id ? `Order reference: ${order.order_id}` : 'Order reference unavailable in source.',
          order.merchant_name ? `Merchant: ${order.merchant_name}` : 'Merchant name unavailable.',
        ],
        toneSeed: `${order.id}:late_delivery`,
        context:
          `Promised delivery: ${order.promised_delivery_time}. ` +
          `Actual delivery: ${order.actual_delivery_time}.`,
        model: 'gpt-4o-mini',
      });
    } catch (e) {
      console.warn('[imap-cron] OpenAI letter failed', e instanceof Error ? e.message : e);
    }
  }

  const nowIso = new Date().toISOString();
  if (letter?.trim()) {
    await admin
      .from('orders')
      .update({
        ai_complaint: letter,
        complaint_status: 'drafted',
        complaint_last_error: null,
        updated_at: nowIso,
      })
      .eq('id', order.id)
      .eq('user_id', order.user_id);
  } else {
    await admin
      .from('orders')
      .update({
        complaint_status: 'draft_failed',
        complaint_last_error: 'openai_not_configured_or_failed',
        updated_at: nowIso,
      })
      .eq('id', order.id)
      .eq('user_id', order.user_id);
  }

  // Optional auto-send (SMTP) when configured.
  if (letter?.trim() && order.smtp?.auto_send_enabled) {
    const to = (order.smtp.auto_send_recipient ?? '').trim();
    if (to) {
      try {
        const platform = asRefundPlatform(order.provider);
        const label =
          platform === 'amazon'
            ? 'Amazon'
            : platform === 'uber_eats'
              ? 'Uber Eats'
              : platform === 'uber_rides'
                ? 'Uber'
                : 'DoorDash';
        const subjectBase = order.order_id ? `Compensation request – Order ${order.order_id}` : 'Compensation request';
        await sendViaGmailSmtp({
          gmailAddress: order.smtp.gmail_address,
          appPassword: order.smtp.app_password,
          to,
          subject: `${label}: ${subjectBase}`,
          text: letter,
          fromName: order.smtp.auto_send_from_name,
        });
        await admin
          .from('orders')
          .update({
            complaint_status: 'sent',
            complaint_sent_at: nowIso,
            complaint_last_error: null,
            updated_at: nowIso,
          })
          .eq('id', order.id)
          .eq('user_id', order.user_id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'send_failed';
        console.warn('[imap-cron] auto-send failed', msg);
        await admin
          .from('orders')
          .update({
            complaint_status: 'send_failed',
            complaint_last_error: msg.slice(0, 500),
            updated_at: nowIso,
          })
          .eq('id', order.id)
          .eq('user_id', order.user_id);
      }
    }
  }

  const { error: insErr } = await admin.from('detected_refunds').insert({
    user_id: order.user_id,
    order_id: order.id,
    reason:
      `IMAP scan: delayed ~${delayMinutes} min. ` +
      (letter ? 'AI compensation letter generated.' : 'OpenAI not configured or failed.'),
    delay_minutes: delayMinutes,
    potential_refund_cents: order.order_value_cents,
    currency: order.currency ?? 'USD',
    status: 'open',
    letter_text: letter,
  });

  if (insErr) {
    console.warn('[imap-cron] detected_refunds insert', insErr.message);
    return { triggered: false, skipped: insErr.message };
  }

  if (letter) {
    console.log('[imap-cron] letter ok user=%s order=%s', order.user_id, order.id);
  }

  return { triggered: true, delay_minutes: delayMinutes };
}
