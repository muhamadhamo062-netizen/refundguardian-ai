import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/api';
import { getStripe } from '@/lib/billing/stripe';

export const dynamic = 'force-dynamic';

/**
 * Stripe Checkout for Pro subscription. Requires STRIPE_SECRET_KEY and STRIPE_PRICE_* env vars.
 * No charge occurs until user completes Checkout with their payment method.
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

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ ok: false, error: 'Billing not configured (STRIPE_SECRET_KEY)' }, { status: 503 });
    }

    let interval: 'month' | 'year' = 'month';
    try {
      const body = (await request.json()) as { interval?: string };
      if (body?.interval === 'year' || body?.interval === 'annual') interval = 'year';
    } catch {
      /* default month */
    }

    const priceId =
      interval === 'year' ? process.env.STRIPE_PRICE_ANNUAL : process.env.STRIPE_PRICE_MONTHLY;
    if (!priceId) {
      return NextResponse.json(
        { ok: false, error: 'Missing STRIPE_PRICE_MONTHLY or STRIPE_PRICE_ANNUAL' },
        { status: 503 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/dashboard?upgraded=1`,
      cancel_url: `${siteUrl}/pricing`,
      metadata: {
        supabase_user_id: user.id,
        billing_interval: interval === 'year' ? 'year' : 'month',
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
        },
      },
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    console.error('[api/billing/create-checkout-session]', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
