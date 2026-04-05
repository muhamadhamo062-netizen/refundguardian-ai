import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/api';
import {
  autoIssueForPlatform,
  buildLoggedMessage,
  estimateRefundUsd,
  platformKeyToProvider,
  type GuidancePlatformKey,
} from '@/lib/guidancePlaceholders';
import type { RefundIssueType } from '@/lib/refundPriorityEngine';
import {
  isCompensationEventsMissingError,
  isOrdersRelationMissingError,
  ordersTableMissingResponse,
} from '@/lib/supabase/dbErrors';

export const dynamic = 'force-dynamic';

const PLATFORMS = new Set<GuidancePlatformKey>(['amazon', 'uber_eats', 'uber_rides']);

const ALLOWED_OPTIONAL: Record<GuidancePlatformKey, readonly string[]> = {
  amazon: ['charged_incorrectly', 'late_delivery'],
  uber_eats: ['missing_item', 'charged_incorrectly', 'cold_food'],
  uber_rides: ['trip_issue'],
};

function sanitizeOptional(platform: GuidancePlatformKey, optional: unknown): string[] | null {
  if (!Array.isArray(optional)) return null;
  const allowed = new Set<string>(ALLOWED_OPTIONAL[platform]);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of optional) {
    if (typeof x !== 'string' || !allowed.has(x) || seen.has(x)) return null;
    seen.add(x);
    out.push(x);
  }
  return out;
}

/**
 * Dynamic compensation ranges (cents). Amazon uses a band around the legacy heuristic.
 */
function compensationRangeCents(
  pk: GuidancePlatformKey,
  optionalSan: string[],
  autoIssue: RefundIssueType
): { minCents: number; maxCents: number; midpointCents: number; midpointUsd: number } {
  if (pk === 'uber_eats') {
    let min = 200;
    let max = 400;
    for (const o of optionalSan) {
      if (o === 'cold_food') {
        min += 200;
        max += 400;
      } else if (o === 'missing_item') {
        min += 400;
        max += 700;
      } else if (o === 'charged_incorrectly') {
        min += 600;
        max += 1000;
      }
    }
    const midpointCents = Math.round((min + max) / 2);
    return { minCents: min, maxCents: max, midpointCents, midpointUsd: midpointCents / 100 };
  }

  if (pk === 'uber_rides') {
    let min = 400;
    let max = 800;
    for (const o of optionalSan) {
      if (o === 'trip_issue') {
        min += 200;
        max += 500;
      }
    }
    const midpointCents = Math.round((min + max) / 2);
    return { minCents: min, maxCents: max, midpointCents, midpointUsd: midpointCents / 100 };
  }

  const refundPlatform = pk as import('@/lib/refundPriorityEngine').RefundPlatform;
  const estUsd = estimateRefundUsd(refundPlatform, autoIssue);
  const cents = Math.round(estUsd * 100);
  const minCents = Math.max(0, Math.round(cents * 0.9));
  const maxCents = Math.round(cents * 1.1);
  const midpointCents = Math.round((minCents + maxCents) / 2);
  return {
    minCents,
    maxCents,
    midpointCents,
    midpointUsd: midpointCents / 100,
  };
}

/**
 * POST — log a Priority Engine confirmation (pre-OpenAI). Optional `order_id` marks that order processed.
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
      return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 401 });
    }

    let body: {
      platform_key?: string;
      optional_issue_types?: unknown;
      order_id?: string | null;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const pk = body.platform_key as GuidancePlatformKey | undefined;
    if (!pk || !PLATFORMS.has(pk)) {
      return NextResponse.json({ ok: false, error: 'Invalid platform_key' }, { status: 400 });
    }

    const optionalSan = sanitizeOptional(pk, body.optional_issue_types);
    if (optionalSan === null) {
      return NextResponse.json(
        { ok: false, error: 'optional_issue_types must be a unique array of allowed issues' },
        { status: 400 }
      );
    }

    const autoIssue = autoIssueForPlatform(pk);
    const provider = platformKeyToProvider(pk);
    const message = buildLoggedMessage({
      platform: pk,
      auto_issue: autoIssue,
      optional_issues: optionalSan as RefundIssueType[],
    });
    const range = compensationRangeCents(pk, optionalSan, autoIssue);
    const estimatedCents = range.midpointCents;
    const estUsd = range.midpointUsd;

    const orderId = typeof body.order_id === 'string' && body.order_id.length > 0 ? body.order_id : null;

    if (orderId) {
      const { data: orderRow, error: orderErr } = await supabase
        .from('orders')
        .select('id')
        .eq('id', orderId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (orderErr && isOrdersRelationMissingError(orderErr)) {
        return NextResponse.json(ordersTableMissingResponse(), { status: 503 });
      }
      if (!orderRow) {
        return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
      }
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('compensation_events')
      .insert({
        user_id: user.id,
        source: 'priority_engine',
        platform_key: pk,
        provider,
        auto_issue_type: autoIssue,
        optional_issue_types: optionalSan,
        message_preview: message,
        estimated_refund_cents: estimatedCents,
        metadata: {
          optional_count: optionalSan.length,
        },
        order_id: orderId,
      })
      .select('id')
      .single();

    if (insertErr) {
      if (isCompensationEventsMissingError(insertErr)) {
        return NextResponse.json(
          { ok: false, error: 'compensation_events table missing — run migrations', db: 'missing_table' },
          { status: 503 }
        );
      }
      console.error('[api/compensation-events POST]', insertErr);
      return NextResponse.json({ ok: false, error: insertErr.message }, { status: 400 });
    }

    let orderUpdated = false;
    if (orderId) {
      const { error: upErr } = await supabase
        .from('orders')
        .update({
          compensation_processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('user_id', user.id);

      if (!upErr) orderUpdated = true;
      else if (isOrdersRelationMissingError(upErr)) {
        return NextResponse.json(ordersTableMissingResponse(), { status: 503 });
      }
    }

    return NextResponse.json({
      ok: true,
      id: inserted?.id,
      logged: true,
      order_updated: orderUpdated,
      platform_key: pk,
      auto_issue_type: autoIssue,
      optional_issue_types: optionalSan,
      message_preview: message,
      estimated_refund_usd: estUsd,
      estimated_refund_cents: estimatedCents,
      estimated_min_cents: range.minCents,
      estimated_max_cents: range.maxCents,
    });
  } catch (e) {
    console.error('[api/compensation-events POST]', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
