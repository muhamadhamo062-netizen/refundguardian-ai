import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '@/lib/supabase/api';
import {
  isOrdersRelationMissingError,
  ordersTableMissingResponse,
} from '@/lib/supabase/dbErrors';

/** Set `ORDERS_API_DEBUG=1` to log server-side issues for this route (default: quiet). */
function logOrdersApiDebug(...args: unknown[]) {
  if (process.env.ORDERS_API_DEBUG === '1') {
    console.error(...args);
  }
}

/** Always logged — post-ingest /analyze and /compensation failures (silent to client). */
function logOrdersAutomationWarn(stage: string, orderId: string, detail: string) {
  const msg = detail.length > 800 ? `${detail.slice(0, 800)}…` : detail;
  console.warn(`[RefundGuardian] [api/orders automation:${stage}] order_id=${orderId}`, msg);
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
 * List latest orders for the authenticated user (Bearer token).
 * Query: ?limit=50 (default 50, max 200), optional ?provider=amazon|uber|...
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Missing Authorization token' },
        { status: 401 }
      );
    }

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

    const supabase = createSupabaseClient(token);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    let q = supabase
      .from('orders')
      .select(
        'id, order_id, merchant_name, order_date, order_value_cents, currency, created_at, raw_email, provider'
      )
      .eq('user_id', user.id);

    if (providerParam && allowedProviders.has(providerParam)) {
      q = q.eq('provider', providerParam);
    }

    const { data: rowsRaw, error } = await q
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (isOrdersRelationMissingError(error)) {
        return NextResponse.json(ordersTableMissingResponse(), { status: 503 });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const rows = (rowsRaw ?? []).filter((r) => {
      const oid = r.order_id ?? '';
      return !String(oid).startsWith('rg-seed-');
    });

    const orders = rows.map((r) => {
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

type ExtensionOrderRow = {
  orderId?: string;
  productTitle?: string;
  price?: string;
  status?: string;
  date?: string;
  /** Optional deep pass from extension (detail/receipt/issue hints). */
  deepScan?: Record<string, unknown>;
};

function parsePriceToCents(price: unknown): number | null {
  if (price == null) return null;
  const s = String(price).replace(/,/g, '');
  const m = s.match(/([\d.]+)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
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
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  /**
   * Unauthed single-order ingest (local extension -> API -> Supabase).
   * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS; writes user_id as NULL.
   */
  if (!token && typeof body.provider === 'string') {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceKey) {
        return NextResponse.json(
          { ok: false, error: 'Missing SUPABASE_SERVICE_ROLE_KEY', db: 'error' as const },
          { status: 500 }
        );
      }

      const provider = String(body.provider || 'other');
      const orderId = typeof body.order_id === 'string' ? body.order_id : null;
      const merchantName = typeof body.merchant_name === 'string' ? body.merchant_name : null;
      const amountNum =
        typeof body.amount === 'number'
          ? body.amount
          : typeof body.amount === 'string'
            ? Number(body.amount)
            : null;
      const createdAt = typeof body.created_at === 'string' ? body.created_at : null;
      const raw = (body.raw as Record<string, unknown> | null) ?? null;

      const supa = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const cents = typeof amountNum === 'number' && Number.isFinite(amountNum) ? Math.round(amountNum * 100) : null;
      const orderDate = createdAt ? toDate(createdAt) : null;

      const { data, error } = await supa
        .from('orders')
        .insert({
          user_id: null,
          provider,
          order_id: orderId,
          merchant_name: merchantName,
          amount: typeof amountNum === 'number' && Number.isFinite(amountNum) ? amountNum : null,
          order_date: orderDate,
          order_value_cents: cents,
          currency: 'USD',
          raw: raw,
          raw_email: raw,
        })
        .select('id')
        .single();

      if (error) {
        if (isOrdersRelationMissingError(error)) {
          return NextResponse.json(ordersTableMissingResponse(), { status: 503 });
        }
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, id: data?.id ?? null });
    } catch (e) {
      logOrdersApiDebug('[api/orders POST unauth]', e);
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : 'Server error' },
        { status: 500 }
      );
    }
  }

  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization token' }, { status: 401 });
  }

  const supabase = createSupabaseClient(token);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  /** Batch ingestion from Chrome extension (Amazon extraction) */
  if (Array.isArray(body.orders)) {
    try {
      const pageUrl = typeof body.url === 'string' ? body.url : '';
      const extractedAt = typeof body.extractedAt === 'string' ? body.extractedAt : null;
      const rows = body.orders as ExtensionOrderRow[];

      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

      const insertedIds: string[] = [];
      const errors: string[] = [];
      let ordersTableMissing = false;

      for (const item of rows) {
        try {
          const orderId = item.orderId ?? null;
          if (orderId && String(orderId).startsWith('rg-seed-')) {
            continue;
          }
          const merchantName = item.productTitle ?? null;
          const orderDate = toDate(item.date) ?? null;
          const cents = parsePriceToCents(item.price);

          const rawPayload: Record<string, unknown> = {
            source: 'amazon_extension',
            page_url: pageUrl,
            batch_extracted_at: extractedAt,
            extracted: item,
          };
          if (item.deepScan && typeof item.deepScan === 'object') {
            rawPayload.deep_scan = item.deepScan;
          }

          const { data: order, error } = await supabase
            .from('orders')
            .insert({
              user_id: user.id,
              provider: 'amazon',
              order_id: orderId,
              order_date: orderDate,
              promised_delivery_time: null,
              actual_delivery_time: null,
              order_value_cents: cents,
              currency: 'USD',
              merchant_name: merchantName,
              raw_email: rawPayload,
            })
            .select('id')
            .single();

          if (error) {
            if (isOrdersRelationMissingError(error)) {
              ordersTableMissing = true;
              errors.push(error.message);
              break;
            }
            errors.push(error.message);
            continue;
          }

          if (order?.id) {
            insertedIds.push(order.id);
            await runAnalyzeAndCompensationChain(baseUrl, token, order.id);
          }
        } catch (rowErr) {
          errors.push(rowErr instanceof Error ? rowErr.message : String(rowErr));
        }
      }

      if (ordersTableMissing) {
        return NextResponse.json(
          {
            ...ordersTableMissingResponse(),
            mode: 'batch' as const,
            inserted: insertedIds.length,
            order_ids: insertedIds,
            errors: errors.length ? errors : undefined,
          },
          { status: 503 }
        );
      }

      return NextResponse.json({
        ok: true,
        mode: 'batch',
        inserted: insertedIds.length,
        order_ids: insertedIds,
        errors: errors.length ? errors : undefined,
      });
    } catch (batchErr) {
      logOrdersApiDebug('[api/orders POST batch]', batchErr);
      return NextResponse.json(
        { ok: false, error: batchErr instanceof Error ? batchErr.message : 'Batch failed' },
        { status: 500 }
      );
    }
  }

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
