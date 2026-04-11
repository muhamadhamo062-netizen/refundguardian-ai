import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { planFromPaddlePriceId } from '@/lib/billing/paddleEnv';
import { verifyPaddleWebhookSignature } from '@/lib/billing/paddleWebhook';

export const dynamic = 'force-dynamic';

type PaddleNotification = {
  event_id?: string;
  event_type?: string;
  data?: Record<string, unknown>;
};

function userIdFromCustomData(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const id = o.supabase_user_id;
  return typeof id === 'string' ? id : undefined;
}

function priceIdFromSubscriptionData(data: Record<string, unknown>): string | undefined {
  const items = data.items;
  if (!Array.isArray(items) || items.length === 0) return undefined;
  const first = items[0] as Record<string, unknown>;
  if (typeof first.price_id === 'string') return first.price_id;
  const price = first.price;
  if (price && typeof price === 'object' && typeof (price as Record<string, unknown>).id === 'string') {
    return (price as Record<string, unknown>).id as string;
  }
  return undefined;
}

function mapSubscriptionStatus(status: string | undefined): string {
  const s = (status ?? '').toLowerCase();
  if (s === 'active') return 'active';
  if (s === 'trialing') return 'trialing';
  if (s === 'past_due') return 'past_due';
  if (s === 'canceled' || s === 'paused') return 'canceled';
  return s || 'none';
}

async function cancelUserSubscription(
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  userId: string
) {
  await admin
    .from('users')
    .update({
      subscription_status: 'canceled',
      plan: 'free',
      paddle_subscription_id: null,
      autonomous_mode_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}

/**
 * Paddle notification webhooks — updates `public.users` for subscriptions.
 * Configure in Paddle → Developer tools → Notifications (same URL as this route).
 * Set `PADDLE_NOTIFICATION_WEBHOOK_SECRET` to the destination’s secret key.
 */
export async function POST(request: Request) {
  const secret = process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'Webhook secret not configured' }, { status: 503 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 503 });
  }

  const rawBody = await request.text();
  const sig = request.headers.get('paddle-signature');
  if (!verifyPaddleWebhookSignature(rawBody, sig, secret)) {
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 400 });
  }

  let payload: PaddleNotification;
  try {
    payload = JSON.parse(rawBody) as PaddleNotification;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = payload.event_type ?? '';
  const data = payload.data ?? {};

  try {
    if (eventType.startsWith('subscription.')) {
      const subId = typeof data.id === 'string' ? data.id : undefined;
      const customerId = typeof data.customer_id === 'string' ? data.customer_id : undefined;
      let userId = userIdFromCustomData(data.custom_data);
      const statusRaw = typeof data.status === 'string' ? data.status : undefined;
      const mapped = mapSubscriptionStatus(statusRaw);
      const priceId = priceIdFromSubscriptionData(data);
      const plan = planFromPaddlePriceId(priceId);

      if (!userId && customerId) {
        const { data: row } = await admin
          .from('users')
          .select('id')
          .eq('paddle_customer_id', customerId)
          .maybeSingle();
        userId = row?.id;
      }

      const isCanceledEvent = eventType === 'subscription.canceled' || mapped === 'canceled';

      if (isCanceledEvent) {
        if (!userId && subId) {
          const { data: row } = await admin
            .from('users')
            .select('id')
            .eq('paddle_subscription_id', subId)
            .maybeSingle();
          userId = row?.id;
        }
        if (userId) {
          await cancelUserSubscription(admin, userId);
        } else {
          console.warn('[api/billing/webhook] cancel without user mapping', eventType, subId);
        }
        return NextResponse.json({ received: true });
      }

      if (!userId) {
        console.warn('[api/billing/webhook] subscription event without user mapping', eventType, subId);
        return NextResponse.json({ received: true });
      }

      const update: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (customerId) update.paddle_customer_id = customerId;
      if (subId) update.paddle_subscription_id = subId;
      update.subscription_status = mapped;

      if (mapped === 'active' || mapped === 'trialing' || mapped === 'past_due') {
        update.plan = plan;
      }

      await admin.from('users').update(update).eq('id', userId);
      return NextResponse.json({ received: true });
    }

    if (eventType === 'transaction.completed') {
      const dataRec = data as Record<string, unknown>;
      const customData =
        (dataRec.custom_data as Record<string, unknown> | undefined) ??
        (dataRec.details as Record<string, unknown> | undefined)?.custom_data;
      const userId = userIdFromCustomData(customData);
      const customerId = typeof dataRec.customer_id === 'string' ? dataRec.customer_id : undefined;
      let subscriptionId =
        typeof dataRec.subscription_id === 'string' ? dataRec.subscription_id : undefined;
      if (!subscriptionId && dataRec.subscription && typeof dataRec.subscription === 'object') {
        const sid = (dataRec.subscription as Record<string, unknown>).id;
        if (typeof sid === 'string') subscriptionId = sid;
      }

      let priceId: string | undefined;
      const items = dataRec.items;
      if (Array.isArray(items) && items.length > 0) {
        const first = items[0] as Record<string, unknown>;
        if (typeof first.price_id === 'string') priceId = first.price_id;
      }

      if (userId && (customerId || subscriptionId)) {
        await admin
          .from('users')
          .update({
            ...(customerId ? { paddle_customer_id: customerId } : {}),
            ...(subscriptionId ? { paddle_subscription_id: subscriptionId } : {}),
            subscription_status: 'active',
            plan: planFromPaddlePriceId(priceId),
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
      }
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('[api/billing/webhook] handle', e);
    return NextResponse.json({ ok: false, error: 'Handler error' }, { status: 500 });
  }
}
