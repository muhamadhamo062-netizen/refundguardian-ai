import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/api';
import { getPaddleServer } from '@/lib/billing/paddleServer';

export const dynamic = 'force-dynamic';

/** Paddle customer portal (authenticated session link). Requires `PADDLE_API_KEY`. */
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
      .select('paddle_customer_id, paddle_subscription_id')
      .eq('id', user.id)
      .single();

    const customerId = row?.paddle_customer_id as string | undefined;
    const subscriptionId = row?.paddle_subscription_id as string | undefined;
    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: 'No Paddle customer on file yet — complete checkout first.' },
        { status: 400 }
      );
    }

    const paddle = getPaddleServer();
    if (!paddle) {
      return NextResponse.json({ ok: false, error: 'Paddle API key not configured' }, { status: 503 });
    }

    const subscriptionIds = subscriptionId ? [subscriptionId] : [];
    const session = await paddle.customerPortalSessions.create(customerId, subscriptionIds);
    const portalUrl = session.urls.general.overview;
    if (!portalUrl || !portalUrl.startsWith('http')) {
      console.error('[api/billing/portal] unexpected Paddle session URLs', session);
      return NextResponse.json({ ok: false, error: 'Billing portal response incomplete' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, url: portalUrl });
  } catch (e) {
    console.error('[api/billing/portal]', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
