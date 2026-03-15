import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/api';

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization token' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const supabase = createSupabaseClient(token);
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  const provider = (body.provider as string) || 'other';
  const providerMap: Record<string, string> = {
    amazon: 'amazon',
    uber: 'uber',
    uber_eats: 'uber_eats',
    doordash: 'doordash',
    grubhub: 'other',
  };
  const safeProvider = providerMap[provider] ?? 'other';

  const toDate = (v: unknown) => {
    if (v == null) return null;
    if (typeof v === 'string') return new Date(v).toISOString();
    return null;
  };

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      user_id: user.id,
      provider: safeProvider,
      order_id: (body.order_id as string) ?? null,
      order_date: toDate(body.order_creation_time) ?? null,
      promised_delivery_time: toDate(body.estimated_delivery_time) ?? null,
      actual_delivery_time: toDate(body.actual_delivery_time) ?? null,
      order_value_cents: typeof body.order_value_cents === 'number' ? body.order_value_cents : null,
      currency: (body.currency as string) ?? 'USD',
      merchant_name: (body.merchant_name as string) ?? null,
      raw_email: body.raw ?? {},
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, order_id: order?.id });
}
