import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseClient } from '@/lib/supabase/api';
import OpenAI from 'openai';

import { getOpenAiChatModel } from '@/lib/ai/openaiModel';

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const bearer = authHeader?.match(/^Bearer\s+(.+)$/i);

  const supabase = bearer
    ? createSupabaseClient(bearer[1])
    : createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { order_id?: string; action?: 'generate' | 'submit' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const orderId = body.order_id;
  if (!orderId) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 });
  }

  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('consent_given_at')
    .eq('id', user.id)
    .single();

  const hasConsent = !!profile?.consent_given_at;

  if (body.action === 'generate') {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json({ message: 'AI message generation not configured', text: null }, { status: 200 });
    }
    const client = new OpenAI({ apiKey: openaiKey });
    const prompt = `Generate a short, professional compensation request message for a delayed delivery.
Provider: ${order.provider}. Order ID: ${order.order_id || 'N/A'}. 
Promised: ${order.promised_delivery_time}. Actual: ${order.actual_delivery_time}.
Request compensation for the delay. One short paragraph, polite but firm.`;
    const completion = await client.chat.completions.create({
      model: getOpenAiChatModel(),
      messages: [
        {
          role: 'system',
          content:
            'You write polished U.S. customer-support English: concise, factual, professional. No threats or fabricated details.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 360,
    });
    const text = completion.choices[0]?.message?.content ?? null;

    // Compute delay and, if delayed, store in detected_refunds
    const promised = order.promised_delivery_time ? new Date(order.promised_delivery_time) : null;
    const actual = order.actual_delivery_time ? new Date(order.actual_delivery_time) : null;
    const isDelayed = promised && actual && actual > promised;
    const delayMinutes = isDelayed && promised && actual
      ? Math.round((actual.getTime() - promised.getTime()) / (1000 * 60))
      : 0;

    if (isDelayed) {
      await supabase.from('detected_refunds').insert({
        user_id: user.id,
        order_id: order.id,
        reason: 'Delayed delivery detected – AI generated compensation request',
        delay_minutes: delayMinutes,
        potential_refund_cents: order.order_value_cents ?? null,
        currency: order.currency ?? 'USD',
        status: 'open',
        letter_text: text,
      });
    }

    return NextResponse.json({
      message: 'Generated',
      text,
      has_consent: hasConsent,
      is_delayed: !!isDelayed,
      delay_minutes: delayMinutes,
    });
  }

  if (body.action === 'submit' && hasConsent) {
    await supabase.from('claims').insert({
      user_id: user.id,
      provider: order.provider,
      status: 'submitted',
      amount_cents: order.order_value_cents,
      currency: order.currency ?? 'USD',
      notes: 'Auto-claim from pipeline',
    });
    return NextResponse.json({ ok: true, message: 'Claim submitted' });
  }

  return NextResponse.json({ ok: false, has_consent: hasConsent, message: 'Consent required to auto-submit' });
}
