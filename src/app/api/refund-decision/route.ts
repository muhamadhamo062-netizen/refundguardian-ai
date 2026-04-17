import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/api';
import { createClient } from '@/lib/supabase/server';
import {
  analyzeRefundDecisions,
  decisionsMapToArrayWithFallback,
} from '@/lib/ai/refundDecisionEngine';
import type { RefundDecisionInput, RefundDecisionWithKey } from '@/lib/ai/refundDecision.types';
import {
  buildStubDecisionsForLockedFreeTier,
  totalPotentialCentsFromDecisions,
} from '@/lib/ai/refundDecisionFreeTier';
import { generateHumanLikeComplaint, type ComplaintPlatform } from '@/lib/ai/complaintGenerator';
import { getOpenAiChatModel } from '@/lib/ai/openaiModel';
import { isFreeTrialAiLocked, isProSubscriber, maxAiOrdersForUser, type UserBillingRow } from '@/lib/billing/plan';

export const dynamic = 'force-dynamic';

const MAX_ORDERS_CAP = 30;

const COMPLAINT_PLATFORMS = new Set<string>([
  'amazon',
  'talabat',
  'instashop',
  'deliveroo',
  'uber_eats',
  'uber_rides',
  'doordash',
]);

function isDelayIssue(issueType: string): boolean {
  return /late|delay/i.test(issueType);
}

function complaintIssuesForPrimaryFree(src: RefundDecisionInput, delay: boolean): string[] {
  if (delay) return ['Late delivery / service delay'];
  const raw = String(src.issue_type || '').trim();
  if (raw) return [raw.length > 140 ? `${raw.slice(0, 137)}…` : raw];
  return ['Order or service issue requiring review and a fair remedy'];
}

function asComplaintPlatform(p: string): ComplaintPlatform | null {
  const low = p.toLowerCase();
  if (COMPLAINT_PLATFORMS.has(low)) return low as ComplaintPlatform;
  return null;
}

/**
 * POST advisory AI refund decisions (OpenAI). Does not mutate orders in DB.
 * Auth: session cookies or optional Bearer (same-origin dashboard).
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    const supabase = token ? createSupabaseClient(token) : createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });
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

    const { data: billingRow, error: billingErr } = await supabase
      .from('users')
      .select('plan, subscription_status, trial_used, last_trial_scan_potential_cents')
      .eq('id', user.id)
      .maybeSingle();

    if (billingErr) {
      return NextResponse.json({ ok: false, error: billingErr.message }, { status: 500 });
    }

    const billing = billingRow as UserBillingRow | null;
    const pro = isProSubscriber(billing);
    const scanLocked = isFreeTrialAiLocked(billing);
    const tierLimit = Math.min(MAX_ORDERS_CAP, maxAiOrdersForUser(billing));
    const orders = ordersRaw.slice(0, tierLimit);

    for (const o of orders) {
      if (!o || typeof o.id !== 'string' || typeof o.order_id !== 'string') {
        return NextResponse.json({ ok: false, error: 'Invalid order payload' }, { status: 400 });
      }
    }

    let enhanced: RefundDecisionWithKey[];
    let trialJustCompleted = false;

    if (scanLocked && !pro) {
      enhanced = buildStubDecisionsForLockedFreeTier(orders);
    } else {
      const map = await analyzeRefundDecisions(orders);
      const baseList = decisionsMapToArrayWithFallback(orders, map);
      const sortedPick = [...baseList].sort((a, b) => b.refund_score - a.refund_score);
      const primaryId = !pro && !billing?.trial_used && sortedPick.length > 0 ? sortedPick[0].id : null;
      const openaiKey = process.env.OPENAI_API_KEY?.trim();
      const model = getOpenAiChatModel();

      enhanced = await Promise.all(
        baseList.map(async (d) => {
          const locked = Boolean(primaryId && d.id !== primaryId);
          if (locked) {
            return {
              ...d,
              pro_locked: true,
              claim_message: '',
              ai_complaint: undefined,
              complaint_status: 'not_applicable' as const,
              reason: `Refyndra estimates up to $${Number(d.estimated_refund ?? 0).toFixed(2)} on this order. Upgrade to Pro to unlock the full AI Lawyer, drafts, and claiming tools.`,
            };
          }

          const src = orders.find((o) => o.id === d.id);
          if (!src) return d;
          const p = String(src.platform || '').toLowerCase();
          const platformKey = asComplaintPlatform(p);
          const delay = isDelayIssue(String(src.issue_type || ''));
          const delayDraftPath = Boolean(platformKey && delay);
          const isPrimaryFree = primaryId !== null && d.id === primaryId;

          if (!openaiKey || !platformKey) {
            return { ...d, complaint_status: 'not_applicable' as const };
          }

          if (!isPrimaryFree && !delayDraftPath) {
            return { ...d, complaint_status: 'not_applicable' as const };
          }

          try {
            const issues = isPrimaryFree ? complaintIssuesForPrimaryFree(src, delay) : ['Late delivery / service delay'];
            const c = await generateHumanLikeComplaint({
              platform: platformKey,
              issues,
              model,
              context: `Advisory scan — order ${src.order_id} (${src.platform}) — ${src.issue_type || 'customer issue'}. Draft a merchant-ready message.`,
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

      if (!pro && !billing?.trial_used && baseList.length > 0) {
        const potentialCents = totalPotentialCentsFromDecisions(baseList);
        const { error: upErr } = await supabase
          .from('users')
          .update({
            trial_used: true,
            last_trial_scan_potential_cents: potentialCents,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
        if (!upErr) trialJustCompleted = true;
      }
    }

    return NextResponse.json({
      ok: true,
      decisions: enhanced,
      advisory: true,
      ai_limit: tierLimit,
      ai_truncated: ordersRaw.length > tierLimit,
      trial_scan_completed: Boolean(billing?.trial_used) || trialJustCompleted || (scanLocked && !pro),
      free_tier_stub: scanLocked && !pro,
      upgrade_required: scanLocked && !pro,
      free_trial_date_filtered: false,
      potential_recoverable_usd:
        enhanced.reduce((s, d) => s + Math.round((d.estimated_refund ?? 0) * 100), 0) / 100,
    });
  } catch (e) {
    console.error('[api/refund-decision POST]', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
