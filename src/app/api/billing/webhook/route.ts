import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/billing/stripe';
import { createServiceRoleClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Stripe webhooks — updates public.users when subscription changes.
 * Requires STRIPE_WEBHOOK_SECRET and SUPABASE_SERVICE_ROLE_KEY.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !whSecret) {
    return NextResponse.json({ ok: false, error: 'Billing not configured' }, { status: 503 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 503 });
  }

  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ ok: false, error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
  } catch (e) {
    console.error('[api/billing/webhook] verify', e);
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId =
          (session.metadata?.supabase_user_id as string | undefined) || session.client_reference_id;
        if (!userId) break;
        const customerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
        const subId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id ?? null;
        const billing = session.metadata?.billing_interval;
        const plan = billing === 'year' ? 'annual' : 'monthly';
        await admin
          .from('users')
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subId,
            subscription_status: 'active',
            plan,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        let userId = sub.metadata?.supabase_user_id as string | undefined;
        if (!userId) {
          const cid = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
          if (cid) {
            const { data: row } = await admin
              .from('users')
              .select('id')
              .eq('stripe_customer_id', cid)
              .maybeSingle();
            userId = row?.id;
          }
        }
        if (!userId) break;
        const st = sub.status;
        const subscription_status =
          st === 'active' || st === 'trialing'
            ? st
            : st === 'canceled' || st === 'unpaid'
              ? 'canceled'
              : 'past_due';
        await admin
          .from('users')
          .update({
            stripe_subscription_id: sub.id,
            subscription_status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        let userId = sub.metadata?.supabase_user_id as string | undefined;
        const cid = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        if (!userId && cid) {
          const { data: row } = await admin
            .from('users')
            .select('id')
            .eq('stripe_customer_id', cid)
            .maybeSingle();
          userId = row?.id;
        }
        if (!userId) break;
        await admin
          .from('users')
          .update({
            subscription_status: 'canceled',
            plan: 'free',
            stripe_subscription_id: null,
            autonomous_mode_enabled: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
        break;
      }
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('[api/billing/webhook] handle', e);
    return NextResponse.json({ ok: false, error: 'Handler error' }, { status: 500 });
  }
}
