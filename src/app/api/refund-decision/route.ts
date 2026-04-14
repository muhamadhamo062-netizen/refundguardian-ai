import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/api';
import { analyzeRefundDecisions, decisionsMapToArray } from '@/lib/ai/refundDecisionEngine';
import type { RefundDecisionInput } from '@/lib/ai/refundDecision.types';
import { generateHumanLikeComplaint, type ComplaintPlatform } from '@/lib/ai/complaintGenerator';
import { isOrderWithinFreeTrialWindow } from '@/lib/billing/orderDateWindow';
import {
  isFreeTrialAiLocked,
  isProSubscriber,
  maxAiOrdersForUser,
  type UserBillingRow,
} from '@/lib/billing/plan';

export const dynamic = 'force-dynamic';

const MAX_ORDERS_CAP = 30;

const DELAY_COMPLAINT_PLATFORMS = new Set<string>([
  'amazon',
  'talabat',
  'instashop',
  'deliveroo',
]);

function isDelayIssue(issueType: string): boolean {
  return /late|delay/i.test(issueType);
}

/**
 * POST advisory AI refund decisions (OpenAI). Does not mutate orders in DB.
 * Free tier: exactly one scan (recent orders only), then trial_used + redirect to upgrade.
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

    const { data: billing } = await supabase
      .from('users')
      .select(
        'plan, subscription_status, trial_ends_at, trial_used, free_trial_initial_scan_completed_at'
      )
      .eq('id', user.id)
      .maybeSingle();

    const pro = isProSubscriber(billing);

    if (!pro && isFreeTrialAiLocked(billing as UserBillingRow | null)) {
      return NextResponse.json(
        {
          ok: false,
          locked: true,
          upgrade_required: true,
          error:
            'Your free value discovery scan is complete. Upgrade to Pro to continue with AI analysis.',
        },
        { status: 403 }
      );
    }

    let eligible = ordersRaw;
    if (!pro) {
      eligible = ordersRaw.filter((o) => isOrderWithinFreeTrialWindow(o.order_date));
    }

    const tierLimit = Math.min(MAX_ORDERS_CAP, maxAiOrdersForUser(billing));
    const orders = eligible.slice(0, tierLimit);

    for (const o of orders) {
      if (!o || typeof o.id !== 'string' || typeof o.order_id !== 'string') {
        return NextResponse.json({ ok: false, error: 'Invalid order payload' }, { status: 400 });
      }
    }

    const map = await analyzeRefundDecisions(orders);
    const decisions = decisionsMapToArray(orders, map);
    const enhanced = await Promise.all(
      decisions.map(async (d) => {
        const src = orders.find((o) => o.id === d.id);
        if (!src) return d;
        const p = String(src.platform || '').toLowerCase();
        if (!DELAY_COMPLAINT_PLATFORMS.has(p) || !isDelayIssue(String(src.issue_type || ''))) {
          return { ...d, complaint_status: 'not_applicable' as const };
        }
        try {
          const c = await generateHumanLikeComplaint({
            platform: p as ComplaintPlatform,
            issues: ['Late delivery / service delay'],
            model: 'gpt-4o-mini',
            context: `Order ${src.order_id} delay complaint`,
          });
          return {
            ...d,
            ai_complaint: c.draft,
            complaint_status: 'generated' as const,
          };
        } catch {
          return { ...d, complaint_status: 'failed' as const };
        }
      })
    );

    const potentialCents = enhanced.reduce(
      (s, d) => s + Math.round((d.estimated_refund ?? 0) * 100),
      0
    );

    let trialScanCompleted = false;
    if (!pro && orders.length > 0) {
      const { error: upErr } = await supabase
        .from('users')
        .update({
          trial_used: true,
          free_trial_initial_scan_completed_at: new Date().toISOString(),
          last_trial_scan_potential_cents: potentialCents,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (!upErr) {
        trialScanCompleted = true;
      }
    }

    return NextResponse.json({
      ok: true,
      decisions: enhanced,
      advisory: true,
      ai_limit: tierLimit,
      ai_truncated: ordersRaw.length > tierLimit || eligible.length < ordersRaw.length,
      trial_scan_completed: trialScanCompleted,
      free_trial_date_filtered: !pro && ordersRaw.length > eligible.length,
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
