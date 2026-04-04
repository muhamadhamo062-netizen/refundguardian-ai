import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/api';
import { getStripe } from '@/lib/billing/stripe';

export const dynamic = 'force-dynamic';

/** Stripe Customer Portal — manage/cancel subscription (hosted by Stripe). */
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

    const { data: row } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    const customerId = row?.stripe_customer_id as string | undefined;
    if (!customerId) {
      return NextResponse.json({ ok: false, error: 'No Stripe customer on file' }, { status: 400 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ ok: false, error: 'Billing not configured' }, { status: 503 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/dashboard`,
    });

    return NextResponse.json({ ok: true, url: portal.url });
  } catch (e) {
    console.error('[api/billing/portal]', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
