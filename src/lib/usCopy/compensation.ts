/**
 * US-facing copy for compensation / recovery messaging (dashboard, emails).
 * Keep tone clear, direct, and legally careful — not a guarantee of payment.
 */

export function formatUsdFromCents(cents: number): string {
  if (!Number.isFinite(cents)) return '$0.00';
  return `$${(cents / 100).toFixed(2)}`;
}

export const US_COPY = {
  firstRecoveryTitle: "You're on the board — we recorded compensation for you",
  firstRecoveryBodyOne: (amount: string) =>
    `We've logged your first compensation credit: ${amount} total tracked in RefundGuardian. Keep the extension connected and your dashboard open so we can keep scanning for more.`,
  firstRecoveryBodyMany: (total: string, count: number) =>
    `So far we've recorded ${total} across ${count} compensation credit${count === 1 ? '' : 's'}. That's real money we're tracking — upgrade to Pro for deeper automation and higher scan limits.`,
  disclaimerShort:
    'RefundGuardian tracks credits and delays based on data we can access. We do not guarantee payment from any merchant or platform; outcomes depend on their policies and your eligibility.',
  ctaUpgrade: 'Upgrade to Pro',
  ctaViewHistory: 'View refund history',
  dismiss: 'Dismiss',

  pipelineTitle: 'How automatic tracking works',
  pipelineBody: [
    'After you install the extension and connect your session, we sync your token in the background while this dashboard stays open.',
    'Open each merchant’s order page once (seed tabs) so the extension can read your history — then new orders are picked up as you use those accounts and pages refresh.',
    'Delivery times and delays are evaluated when the platform exposes enough data — not every order includes a guaranteed timestamp.',
  ],
  openAiTitle: 'Claim letters & OpenAI (optional pipeline)',
  openAiBody:
    'When you configure a server-side webhook URL, RefundGuardian can POST structured events (order, delay, platform) so your OpenAI workflow can draft varied, human-style claim language. This is not legal advice and does not force any company to pay — it supports your outreach process.',
} as const;
