import { NextResponse } from 'next/server';
import { analyzeRefundDecisions, decisionsMapToArray } from '@/lib/ai/refundDecisionEngine';
import type { RefundDecisionInput } from '@/lib/ai/refundDecision.types';
import { requireUser } from '@/lib/supabase/requireUser';

export const dynamic = 'force-dynamic';

const MAX_ORDERS_CAP = 30;

/**
 * Unified AI decision endpoint:
 * - no trial/pro gating
 * - analyzes up to MAX_ORDERS_CAP
 * - persists generated complaint text on `orders.ai_complaint` when present
 */
export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
    }
    const { supabase, user } = auth;

    let body: { orders?: RefundDecisionInput[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const ordersRaw = Array.isArray(body.orders) ? body.orders : [];
    if (ordersRaw.length === 0) {
      return NextResponse.json({
        ok: true,
        decisions: [],
        advisory: true,
        ai_limit: 0,
        ai_truncated: false,
        trial_scan_completed: false,
      });
    }

    const orders = ordersRaw.slice(0, MAX_ORDERS_CAP);

    for (const o of orders) {
      if (!o || typeof o.id !== 'string' || typeof o.order_id !== 'string') {
        return NextResponse.json({ ok: false, error: 'Invalid order payload' }, { status: 400 });
      }
    }

    const map = await analyzeRefundDecisions(orders);
    const decisions = decisionsMapToArray(orders, map);

    const potentialCents = decisions.reduce(
      (s, d) => s + Math.round((d.estimated_refund ?? 0) * 100),
      0
    );

    // Best-effort persistence: make generated AI complaint universally available across devices.
    await Promise.all(
      decisions.map(async (d) => {
        const complaint = d.ai_complaint ?? d.claim_message;
        if (!complaint?.trim()) return;
        await supabase
          .from('orders')
          .update({
            ai_complaint: complaint,
            updated_at: new Date().toISOString(),
          })
          .eq('id', d.id)
          .eq('user_id', user.id);
      })
    );

    return NextResponse.json({
      ok: true,
      decisions,
      advisory: true,
      ai_limit: MAX_ORDERS_CAP,
      ai_truncated: ordersRaw.length > MAX_ORDERS_CAP,
      trial_scan_completed: false,
      free_trial_date_filtered: false,
      potential_recoverable_usd: potentialCents / 100,
    });
  } catch (e) {
    console.error('[api/refund-decision POST]', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
