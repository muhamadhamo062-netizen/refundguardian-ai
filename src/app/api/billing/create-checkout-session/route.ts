import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/api';
import { getPaddlePriceIds } from '@/lib/billing/paddleEnv';

export const dynamic = 'force-dynamic';

/**
 * Returns Paddle Billing checkout payload (overlay). Client opens checkout via `@paddle/paddle-js`.
 * Requires NEXT_PUBLIC_PADDLE_CLIENT_TOKEN, PADDLE_PRICE_MONTHLY, PADDLE_PRICE_ANNUAL.
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

    const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim();
    if (!clientToken) {
      return NextResponse.json(
        { ok: false, error: 'Paddle client token not configured (NEXT_PUBLIC_PADDLE_CLIENT_TOKEN)' },
        { status: 503 }
      );
    }

    let interval: 'month' | 'year' = 'month';
    try {
      const body = (await request.json()) as { interval?: string };
      if (body?.interval === 'year' || body?.interval === 'annual') interval = 'year';
    } catch {
      /* default month */
    }

    const { monthly, annual } = getPaddlePriceIds();
    const priceId = interval === 'year' ? annual : monthly;
    if (!priceId) {
      return NextResponse.json(
        { ok: false, error: 'Paddle price IDs missing (PADDLE_PRICE_MONTHLY / PADDLE_PRICE_ANNUAL)' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      provider: 'paddle' as const,
      checkout: {
        priceId,
        customerEmail: user.email ?? null,
        customData: {
          supabase_user_id: user.id,
          billing_interval: interval === 'year' ? 'year' : 'month',
        } satisfies Record<string, string>,
      },
    });
  } catch (e) {
    console.error('[api/billing/create-checkout-session]', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
