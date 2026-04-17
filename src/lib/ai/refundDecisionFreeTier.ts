import type { RefundDecisionInput, RefundDecisionOutput, RefundDecisionWithKey } from '@/lib/ai/refundDecision.types';

/** Heuristic advisory when OpenAI is not run (free tier after complimentary scan consumed). */
export function buildStubDecisionsForLockedFreeTier(inputs: RefundDecisionInput[]): RefundDecisionWithKey[] {
  const out: RefundDecisionWithKey[] = [];
  for (const i of inputs) {
    const base = typeof i.amount === 'number' && Number.isFinite(i.amount) ? Math.max(0, i.amount) : 8;
    const estimated = Math.min(45, Math.round(base * 0.15 * 100) / 100);
    const row: RefundDecisionOutput = {
      refund_score: 62,
      priority: 'MEDIUM',
      estimated_refund: estimated,
      reason:
        'Refyndra detected a savings signal on this order. Upgrade to Pro to unlock the full AI Lawyer, drafts, and claiming workflow.',
      claim_message: '',
      confidence: 55,
      complaint_status: 'not_applicable',
      pro_locked: true,
    };
    out.push({ ...row, id: i.id, order_id: i.order_id });
  }
  return out;
}

export function totalPotentialCentsFromDecisions(decisions: RefundDecisionWithKey[]): number {
  return decisions.reduce((s, d) => s + Math.round((d.estimated_refund ?? 0) * 100), 0);
}
