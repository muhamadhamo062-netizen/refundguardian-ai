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
    `We've logged your first compensation credit: ${amount} total tracked in Refyndra. Keep Gmail connected and check back here after scans so we can keep tracking more.`,
  firstRecoveryBodyMany: (total: string, count: number) =>
    `So far we've recorded ${total} across ${count} compensation credit${count === 1 ? '' : 's'}. That's real money we're tracking — stay signed in and keep inbox sync on for updates.`,
  disclaimerShort:
    'Refyndra tracks credits and delays based on data we can access. We do not guarantee payment from any merchant or platform; outcomes depend on their policies and your eligibility.',
  ctaUpgrade: 'Upgrade to Pro',
  ctaViewHistory: 'View refund history',
  dismiss: 'Dismiss',

  pipelineTitle: 'How Refyndra stays on top of your orders',
  pipelineBody: [
    'Sign in once — same account on phone and desktop — then connect Gmail with an App Password from this dashboard.',
    'We read delivery-style receipts from supported merchants in your inbox.',
    'We look for delays and issues when messages include enough detail — not every order has perfect timing data.',
  ],
  openAiTitle: 'Smarter claim messages (optional)',
  openAiBody:
    'Refyndra AI drafts clear, firm dispute-style messages for you to review before you send anything.',
} as const;
