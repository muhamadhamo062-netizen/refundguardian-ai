import { NextResponse } from 'next/server';
import {
  isOrdersRelationMissingError,
  ordersTableMissingResponse,
} from '@/lib/supabase/dbErrors';
import { requireUser } from '@/lib/supabase/requireUser';

/** Set `ORDERS_API_DEBUG=1` to log server-side issues for this route (default: quiet). */
function logOrdersApiDebug(...args: unknown[]) {
  if (process.env.ORDERS_API_DEBUG === '1') {
    console.error(...args);
  }
}

function formatPriceDisplay(cents: number | null, currency: string | null): string {
  if (cents == null) return '—';
  const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  return `${sym}${(cents / 100).toFixed(2)}`;
}

/**
 * List latest orders for the authenticated user (Supabase cookie session).
 * Query: ?limit=50 (default 50, max 200), optional ?provider=amazon|uber|...
 */
export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
    }
    const { supabase, user } = auth;

    const { searchParams } = new URL(request.url);
    const limitRaw = searchParams.get('limit');
    let limit = parseInt(limitRaw ?? '50', 10);
    if (Number.isNaN(limit) || limit < 1) limit = 50;
    limit = Math.min(200, Math.max(1, limit));

    const providerParam = searchParams.get('provider');
    const allowedProviders = new Set([
      'amazon',
      'uber',
      'uber_eats',
      'doordash',
      'other',
    ]);

    const { data: rowsRaw, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (isOrdersRelationMissingError(error)) {
        return NextResponse.json(ordersTableMissingResponse(), { status: 503 });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    type OrderRow = {
      id?: string;
      order_id?: string | null;
      merchant_name?: string | null;
      order_date?: string | null;
      order_value_cents?: number | null;
      currency?: string | null;
      created_at?: string | null;
      raw_email?: unknown;
      provider?: string | null;
    };

    let rows = (rowsRaw ?? []) as OrderRow[];
    if (providerParam && allowedProviders.has(providerParam)) {
      rows = rows.filter((r) => (r.provider ?? 'other') === providerParam);
    }

    const rowsFiltered = rows.filter((r) => {
      const oid = r.order_id ?? '';
      return !String(oid).startsWith('rg-seed-');
    });

    const orders = rowsFiltered.map((r) => {
      const raw = (r.raw_email as Record<string, unknown> | null) || {};
      const extractedAt =
        typeof raw.batch_extracted_at === 'string'
          ? raw.batch_extracted_at
          : r.created_at
            ? new Date(r.created_at).toISOString()
            : '';
      const od = r.order_date ? new Date(r.order_date) : null;
      return {
        id: r.id,
        orderId: r.order_id ?? '',
        productName: r.merchant_name ?? '',
        price: formatPriceDisplay(r.order_value_cents, r.currency),
        date: od && !Number.isNaN(od.getTime()) ? od.toISOString().slice(0, 10) : '',
        backendStatus: 'ok' as const,
        extractedAt,
        source: 'database' as const,
        provider: r.provider ?? 'other',
      };
    });

    return NextResponse.json({
      ok: true,
      orders,
      count: orders.length,
    });
  } catch (e) {
    logOrdersApiDebug('[api/orders GET]', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

function toDate(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }
  const { supabase, user } = auth;

  /** Single-order (legacy) */
  const provider = (body.provider as string) || 'other';
  const providerMap: Record<string, string> = {
    amazon: 'amazon',
    uber: 'uber',
    uber_eats: 'uber_eats',
    doordash: 'doordash',
    grubhub: 'other',
  };
  const safeProvider = providerMap[provider] ?? 'other';

  const toDateLegacy = (v: unknown) => {
    if (v == null) return null;
    if (typeof v === 'string') return new Date(v).toISOString();
    return null;
  };

  let order: { id: string } | null = null;
  try {
    const res = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        provider: safeProvider,
        order_id: (body.order_id as string) ?? null,
        order_date: toDateLegacy(body.order_creation_time) ?? null,
        promised_delivery_time: toDateLegacy(body.estimated_delivery_time) ?? null,
        actual_delivery_time: toDateLegacy(body.actual_delivery_time) ?? null,
        order_value_cents: typeof body.order_value_cents === 'number' ? body.order_value_cents : null,
        currency: (body.currency as string) ?? 'USD',
        merchant_name: (body.merchant_name as string) ?? null,
        raw_email: body.raw ?? {},
      })
      .select('id')
      .single();

    if (res.error) {
      if (isOrdersRelationMissingError(res.error)) {
        return NextResponse.json(ordersTableMissingResponse(), { status: 503 });
      }
      return NextResponse.json({ ok: false, error: res.error.message }, { status: 400 });
    }
    order = res.data;
  } catch (e) {
    logOrdersApiDebug('[api/orders POST single]', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Insert failed' },
      { status: 500 }
    );
  }

  if (order?.id) {
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    await runAnalyzeAndCompensationChain(baseUrl, token, order.id);
  }

  return NextResponse.json({ ok: true, order_id: order?.id });
}
