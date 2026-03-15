import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { order_id?: string };
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

  const promised = order.promised_delivery_time ? new Date(order.promised_delivery_time) : null;
  const actual = order.actual_delivery_time ? new Date(order.actual_delivery_time) : null;
  const isDelayed = promised && actual && actual > promised;
  const delayMinutes = isDelayed && promised && actual
    ? Math.round((actual.getTime() - promised.getTime()) / (1000 * 60))
    : 0;

  return NextResponse.json({
    order_id: order.id,
    is_delayed: isDelayed,
    delay_minutes: delayMinutes,
    eligible_for_compensation: isDelayed,
    provider: order.provider,
  });
}
