import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  const supabase = createClient();
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
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
    });
    const text = completion.choices[0]?.message?.content ?? null;
    return NextResponse.json({ message: 'Generated', text, has_consent: hasConsent });
  }

  if (body.action === 'submit' && hasConsent) {
    await supabase.from('claims').insert({
      user_id: user.id,
      provider: order.provider,
      status: 'submitted',
      amount_cents: order.order_value_cents,
      currency: order.currency ?? 'USD',
      notes: 'Auto-claim from extension',
    });
    return NextResponse.json({ ok: true, message: 'Claim submitted' });
  }

  return NextResponse.json({ ok: false, has_consent: hasConsent, message: 'Consent required to auto-submit' });
}
