import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/api';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import {
  isOrdersRelationMissingError,
  ordersTableMissingResponse,
} from '@/lib/supabase/dbErrors';
import { getPublicSiteUrl } from '@/lib/siteUrl';

/** Set `ORDERS_API_DEBUG=1` to log server-side issues for this route (default: quiet). */
function logOrdersApiDebug(...args: unknown[]) {
  if (process.env.ORDERS_API_DEBUG === '1') {
    console.error(...args);
  }
}

/** Logged only when `ORDERS_API_DEBUG=1` (default: quiet in production). */
function logOrdersAutomationWarn(stage: string, orderId: string, detail: string) {
  if (process.env.ORDERS_API_DEBUG !== '1') return;
  const msg = detail.length > 800 ? `${detail.slice(0, 800)}…` : detail;
  console.warn(`[Refyndra] [api/orders automation:${stage}] order_id=${orderId}`, msg);
}

async function runAnalyzeAndCompensationChain(
  baseUrl: string,
  token: string,
  orderId: string
): Promise<void> {
  let analyzeRes: Response;
  try {
    analyzeRes = await fetch(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ order_id: orderId }),
    });
  } catch (e) {
    logOrdersAutomationWarn(
      'analyze_fetch',
      orderId,
      e instanceof Error ? e.message : String(e)
    );
    return;
  }

  if (!analyzeRes.ok) {
    const t = await analyzeRes.text().catch(() => '');
    logOrdersAutomationWarn(
      'analyze_http',
      orderId,
      `status=${analyzeRes.status} ${t}`
    );
    return;
  }

  let analyzeData: { is_delayed?: boolean };
  try {
    analyzeData = await analyzeRes.json();
  } catch (e) {
    logOrdersAutomationWarn('analyze_json', orderId, e instanceof Error ? e.message : String(e));
    return;
  }

  if (!analyzeData?.is_delayed) return;

  try {
    const compRes = await fetch(`${baseUrl}/api/compensation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ order_id: orderId, action: 'generate' }),
    });
    if (!compRes.ok) {
      const t = await compRes.text().catch(() => '');
      logOrdersAutomationWarn('compensation_http', orderId, `status=${compRes.status} ${t}`);
    }
  } catch (e) {
    logOrdersAutomationWarn(
      'compensation_fetch',
      orderId,
      e instanceof Error ? e.message : String(e)
    );
  }
}

function formatPriceDisplay(cents: number | null, currency: string | null): string {
  if (cents == null) return '—';
  const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  return `${sym}${(cents / 100).toFixed(2)}`;
}

/**
 * List latest orders for the signed-in user (session cookies or optional Bearer).
 * Query: ?limit=50 (default 50, max 200), optional ?provider=amazon|uber|...
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    const supabase = token ? createSupabaseClient(token) : createServerSupabase();

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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Sign in required' },
        { status: 401 }
      );
    }

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

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (Array.isArray(body.orders)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Batch order upload is disabled. Connect Gmail on the dashboard and use inbox sync.',
      },
      { status: 410 }
    );
  }

  const authHeader = request.headers.get('Authorization');
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, '');
  const supabase = bearerToken ? createSupabaseClient(bearerToken) : createServerSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let automationToken = bearerToken ?? '';
  if (!automationToken) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    automationToken = session?.access_token ?? '';
  }

  /** Single-order (server or trusted client; not used for browser batch upload). */
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

  if (order?.id && automationToken) {
    const baseUrl = getPublicSiteUrl();
    await runAnalyzeAndCompensationChain(baseUrl, automationToken, order.id);
  }

  return NextResponse.json({ ok: true, order_id: order?.id });
}
