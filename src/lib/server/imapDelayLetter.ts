/**
 * When IMAP-parsed order has promised vs actual delivery and delay > 15 minutes:
 * generate a compensation letter via OpenAI (if configured) and log `detected_refunds`.
 * Mirrors `/api/compensation` `action: generate` behavior using the service role.
 */

import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getOpenAiChatModel } from '@/lib/ai/openaiModel';

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
};

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
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    try {
      const client = new OpenAI({ apiKey: openaiKey });
      const model = getOpenAiChatModel();
      const completion = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You write clear, executive-level American English for customer-to-support messages. No threats, no invented facts.',
          },
          {
            role: 'user',
            content:
              `Draft a brief compensation request for a delayed delivery (one tight paragraph, merchant support tone). ` +
              `Provider: ${order.provider}. Order ID: ${order.order_id || 'N/A'}. ` +
              `Promised delivery: ${order.promised_delivery_time}. Actual delivery: ${order.actual_delivery_time}. ` +
              `Delay was approximately ${delayMinutes} minutes (threshold ${DELAY_THRESHOLD_MIN}+ minutes). ` +
              `State the issue, cite times factually, and ask for a fair remedy.`,
          },
        ],
        max_tokens: 420,
        temperature: 0.72,
      });
      letter = completion.choices[0]?.message?.content?.trim() ?? null;
    } catch (e) {
      console.warn('[imap-cron] OpenAI letter failed', e instanceof Error ? e.message : e);
    }
  }

  const { data: dr, error: insErr } = await admin
    .from('detected_refunds')
    .insert({
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
    })
    .select('id')
    .single();

  if (insErr) {
    console.warn('[imap-cron] detected_refunds insert', insErr.message);
    return { triggered: false, skipped: insErr.message };
  }

  const { error: notifErr } = await admin.from('notifications').insert({
    user_id: order.user_id,
    type: 'refund_opportunity',
    title: 'Refund opportunity found',
    body: `Late delivery detected (~${delayMinutes} min vs promised time). Open your dashboard to review.`,
    data: {
      order_id: order.id,
      detected_refund_id: dr?.id ?? null,
      source: 'imap_sync',
      provider: order.provider,
    },
  });
  if (notifErr) {
    console.warn('[imap-cron] notifications insert', notifErr.message);
  }

  return { triggered: true, delay_minutes: delayMinutes };
}
