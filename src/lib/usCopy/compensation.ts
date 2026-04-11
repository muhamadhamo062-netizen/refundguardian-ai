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
    `We've logged your first compensation credit: ${amount} total tracked in Refyndra. Keep the extension connected and your dashboard open so we can keep scanning for more.`,
  firstRecoveryBodyMany: (total: string, count: number) =>
    `So far we've recorded ${total} across ${count} compensation credit${count === 1 ? '' : 's'}. That's real money we're tracking — upgrade to Pro for deeper automation and higher scan limits.`,
  disclaimerShort:
    'Refyndra tracks credits and delays based on data we can access. We do not guarantee payment from any merchant or platform; outcomes depend on their policies and your eligibility.',
  ctaUpgrade: 'Upgrade to Pro',
  ctaViewHistory: 'View refund history',
  dismiss: 'Dismiss',

  pipelineTitle: 'How Refyndra stays on top of your orders',
  pipelineBody: [
    'Connect once from this dashboard — Refyndra keeps working while you browse supported stores.',
    'Open your order history on each store you care about so we can learn your recent activity.',
    'We look for delays and issues when the store shows enough detail — not every order has perfect timing data.',
  ],
  openAiTitle: 'Smarter claim messages (optional)',
  openAiBody:
    'Refyndra AI drafts clear, polite messages to merchants for you. Upgrade to Pro to unlock.',
} as const;
