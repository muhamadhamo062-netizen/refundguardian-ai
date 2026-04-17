/**
 * Refund success + upgrade CTA — email and in-app modal (same merge fields).
 */

import {
  GOLDEN_EMAIL_SUBJECT,
  UPGRADE_MORE_WAITING_LINE,
  UPGRADE_PRICE_STEAL_DISPLAY,
} from '@/lib/refyndraCoreBusiness';

export type RefundSuccessMergeFields = {
  userDisplayName: string;
  platformLabel: string;
  amountFormatted: string;
  monthlyPriceDisplay: string;
  annualPriceDisplay: string;
  upgradeUrl: string;
  pricingUrl: string;
  /** Marketing line after the first recovery (not a guarantee of future amounts). */
  moreWaitingLine: string;
  upgradeStealDisplay: string;
};

export function formatUsd(cents: number): string {
  if (!Number.isFinite(cents)) return '$0.00';
  return `$${(cents / 100).toFixed(2)}`;
}

export function buildRefundEmailSubject(_platformLabel: string): string {
  return GOLDEN_EMAIL_SUBJECT;
}

export function buildRefundEmailText(f: RefundSuccessMergeFields): string {
  return `Hi ${f.userDisplayName},

Congratulations! Refyndra AI has successfully recovered your ${f.amountFormatted} refund from ${f.platformLabel}.

${f.moreWaitingLine}

Upgrade to Pro for just ${f.upgradeStealDisplay} to unlock your full AI Lawyer and claim every cent you are owed — compared to what you could leave on the table, it's a one-time steal.

Monthly: ${f.monthlyPriceDisplay}
Annual (best value): ${f.annualPriceDisplay}

Upgrade now: ${f.upgradeUrl}
See all plans: ${f.pricingUrl}

Refyndra never charges without explicit checkout. Outcomes depend on merchant policies; not a guarantee of future refunds.`;
}

export function buildRefundEmailHtml(f: RefundSuccessMergeFields): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.55;color:#e4e4e7;background:#09090b;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#18181b;border-radius:12px;padding:28px;border:1px solid #27272a;">
<p style="margin:0 0 16px;font-size:17px;">Hi ${escape(f.userDisplayName)},</p>
<p style="margin:0 0 16px;font-size:17px;">Congratulations! Refyndra AI has successfully recovered your <strong>${escape(f.amountFormatted)}</strong> refund from <strong>${escape(f.platformLabel)}</strong>.</p>
<p style="margin:0 0 16px;font-size:16px;color:#d4d4d8;">${escape(f.moreWaitingLine)}</p>
<p style="margin:0 0 16px;font-size:16px;">Upgrade to Pro for just <strong>${escape(f.upgradeStealDisplay)}</strong> to unlock your full AI Lawyer and claim every cent you are owed — compared to what you could leave on the table, it&apos;s a one-time steal.</p>
<p style="margin:0 0 8px;font-size:15px;"><strong>Monthly:</strong> ${escape(f.monthlyPriceDisplay)}</p>
<p style="margin:0 0 20px;font-size:15px;"><strong>Annual (best value):</strong> ${escape(f.annualPriceDisplay)}</p>
<p style="margin:0;">
  <a href="${escape(f.upgradeUrl)}" style="display:inline-block;background:#a78bfa;color:#0b0b0f;font-weight:700;padding:12px 20px;border-radius:8px;text-decoration:none;">Upgrade to Pro</a>
</p>
<p style="margin:16px 0 0;font-size:13px;color:#a1a1aa;">Refyndra never charges without explicit checkout. Outcomes depend on merchant policies; not a guarantee of future refunds.</p>
</div></body></html>`;
}

export function mergeFieldsFromNotificationData(
  data: Record<string, unknown> | null | undefined,
  siteUrl: string
): RefundSuccessMergeFields | null {
  if (!data || typeof data !== 'object') return null;
  const platformLabel = typeof data.platform_label === 'string' ? data.platform_label : 'your';
  const amountCents = typeof data.amount_cents === 'number' ? data.amount_cents : 0;
  const userDisplayName =
    typeof data.user_display_name === 'string' && data.user_display_name.trim()
      ? data.user_display_name.trim()
      : 'there';
  const monthly =
    process.env.NEXT_PUBLIC_PRO_MONTHLY_DISPLAY?.trim() || '$9/month';
  const annual = process.env.NEXT_PUBLIC_PRO_ANNUAL_DISPLAY?.trim() || '$89/year';
  const base = siteUrl.replace(/\/$/, '');
  const moreLine =
    process.env.NEXT_PUBLIC_UPGRADE_TEASER_LINE?.trim() || UPGRADE_MORE_WAITING_LINE;
  return {
    userDisplayName,
    platformLabel,
    amountFormatted: formatUsd(amountCents),
    monthlyPriceDisplay: monthly,
    annualPriceDisplay: annual,
    upgradeUrl: `${base}/pricing`,
    pricingUrl: `${base}/pricing`,
    moreWaitingLine: moreLine,
    upgradeStealDisplay: UPGRADE_PRICE_STEAL_DISPLAY,
  };
}
