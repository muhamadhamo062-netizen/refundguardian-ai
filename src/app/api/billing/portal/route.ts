import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/api';
export const dynamic = 'force-dynamic';

type PaddlePortalApiResponse = {
  data?: {
    urls?: {
      general?: Record<string, string | undefined>;
    };
  };
};

function firstHttpUrl(obj: Record<string, string | undefined> | undefined): string | null {
  if (!obj) return null;
  for (const v of Object.values(obj)) {
    if (typeof v === 'string' && v.startsWith('http')) return v;
  }
  return null;
}

/** Paddle customer portal (authenticated session link). Requires PADDLE_API_KEY. */
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

    const apiKey = process.env.PADDLE_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'Paddle API key not configured' }, { status: 503 });
    }

    const body: { subscription_ids?: string[] } = {};
    if (subscriptionId) {
      body.subscription_ids = [subscriptionId];
    }

    const res = await fetch(`https://api.paddle.com/customers/${encodeURIComponent(customerId)}/portal-sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => ({}))) as PaddlePortalApiResponse;
    if (!res.ok) {
      console.error('[api/billing/portal] Paddle API', res.status, json);
      return NextResponse.json(
        { ok: false, error: 'Could not open billing portal' },
        { status: res.status >= 400 ? res.status : 502 }
      );
    }

    const portalUrl =
      firstHttpUrl(json?.data?.urls?.general) ??
      // fallback: some API versions nest differently
      (typeof (json as { data?: { urls?: { general?: string } } }).data?.urls?.general === 'string'
        ? ((json as { data?: { urls?: { general?: string } } }).data?.urls?.general as string)
        : null);

    if (!portalUrl) {
      console.error('[api/billing/portal] unexpected Paddle response', json);
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
