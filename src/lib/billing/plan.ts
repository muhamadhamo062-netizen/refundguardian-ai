/**
 * Plan gating — subscription billing via checkout; no charges without checkout.
 * Product rules (first win, golden email, locks): see `src/lib/refyndraCoreBusiness.ts` + `/api/refund-decision`.
 */

/** One complimentary full AI unlock (highest-priority order) for non‑Pro users. */
export const FREE_TIER_AI_ORDER_LIMIT = 30;
export const PRO_AI_ORDER_LIMIT = 30;

export type UserBillingRow = {
  plan: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  autonomous_mode_enabled?: boolean | null;
  /** Paddle Billing (`ctm_*` / `sub_*`). */
  paddle_customer_id?: string | null;
  paddle_subscription_id?: string | null;
  /** Legacy timestamp; prefer trial_used. */
  free_trial_initial_scan_completed_at?: string | null;
  /** Single complimentary AI scan consumed for non-Pro (strict lock). */
  trial_used?: boolean | null;
  /** Advisory sum from that scan (USD cents). */
  last_trial_scan_potential_cents?: number | null;
};

export function isProSubscriber(p: UserBillingRow | null | undefined): boolean {
  if (!p) return false;
  const plan = (p.plan ?? '').toLowerCase().trim();
  const st = (p.subscription_status ?? '').toLowerCase().trim();
  const paidPlan =
    plan === 'pro' || plan === 'monthly' || plan === 'annual' || plan === 'year' || plan === 'lifetime';
  return paidPlan && (st === 'active' || st === 'trialing');
}

export function isTrialWindowOpen(p: UserBillingRow | null | undefined): boolean {
  if (!p?.trial_ends_at) return false;
  return new Date(p.trial_ends_at) > new Date();
}

/** Full days remaining in the free-trial window (0 if ended today or past). */
export function trialDaysRemaining(p: UserBillingRow | null | undefined): number | null {
  if (!p?.trial_ends_at || !isTrialWindowOpen(p)) return null;
  const end = new Date(p.trial_ends_at).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / 86_400_000));
}

export function maxAiOrdersForUser(p: UserBillingRow | null | undefined): number {
  return isProSubscriber(p) ? PRO_AI_ORDER_LIMIT : FREE_TIER_AI_ORDER_LIMIT;
}

export function planLabel(p: UserBillingRow | null | undefined): string {
  if (isProSubscriber(p)) return 'Pro';
  if (isTrialWindowOpen(p)) return 'Free trial';
  return 'Free';
}

/** Non‑Pro user has consumed the one-time complimentary AI unlock (`trial_used`). */
export function isFreeTrialAiLocked(p: UserBillingRow | null | undefined): boolean {
  if (isProSubscriber(p)) return false;
  return Boolean(p?.trial_used);
}
