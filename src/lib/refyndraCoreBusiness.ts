/**
 * Refyndra core business rules (source of truth for product copy + limits).
 * - Free tier: one complimentary full AI unlock on the highest‑priority order; then `trial_used` gates OpenAI.
 * - Pro: paid Paddle plan (`monthly` / `annual`) with active or trialing subscription.
 * - Success email: “Golden email” after first detected recovery (queued in `notifications`, sent via Resend).
 */

export const GOLDEN_EMAIL_SUBJECT = 'Congrats! Refyndra AI just found your money 💰';

export const UPGRADE_PRICE_STEAL_DISPLAY = '$9';

/** Shown in the golden email as the “more waiting” hook (marketing line, not a guarantee). */
export const UPGRADE_MORE_WAITING_LINE =
  'But we found $40+ more waiting in your history! Upgrade to Pro for just $9 to unlock your full AI Lawyer and claim every cent you are owed.';
