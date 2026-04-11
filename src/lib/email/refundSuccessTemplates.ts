/**
 * Refund success + upgrade CTA — email and in-app modal (same merge fields).
 */

export type RefundSuccessMergeFields = {
  userDisplayName: string;
  platformLabel: string;
  amountFormatted: string;
  monthlyPriceDisplay: string;
  annualPriceDisplay: string;
  upgradeUrl: string;
  pricingUrl: string;
};

export function formatUsd(cents: number): string {
  if (!Number.isFinite(cents)) return '$0.00';
  return `$${(cents / 100).toFixed(2)}`;
}

export function buildRefundEmailSubject(platformLabel: string): string {
  return `Check your ${platformLabel} Account! We got your money back 💰`;
}

export function buildRefundEmailText(f: RefundSuccessMergeFields): string {
  return `Hi ${f.userDisplayName},

Check your ${f.platformLabel} account right now! 💰 We just confirmed that your ${f.amountFormatted} refund is officially back in your balance.

We got you this one for free to show you the power of Refyndra AI. We wanted to prove one thing: your money shouldn't be lost as long as Refyndra is watching your back. This refund was on us so you could experience the true potential of our AI.

To keep the bot hunting for refunds 24/7 and catching every delay for all your future orders, upgrade to Pro now:

Monthly Pro: ${f.monthlyPriceDisplay}, so this subscription literally pays for itself!*

Annual (best value): ${f.annualPriceDisplay} — Save 25%!

Don't let another refund slip away. Keep your protection active!

Upgrade: ${f.upgradeUrl}
All plans: ${f.pricingUrl}

*Outcomes depend on merchant policies; not a guarantee of future refunds.`;
}

export function buildRefundEmailHtml(f: RefundSuccessMergeFields): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#e4e4e7;background:#09090b;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#18181b;border-radius:12px;padding:28px;border:1px solid #27272a;">
<p style="margin:0 0 16px;font-size:16px;">Hi ${escape(f.userDisplayName)},</p>
<p style="margin:0 0 16px;font-size:16px;">Check your <strong>${escape(f.platformLabel)}</strong> account right now! 💰 We just confirmed that your <strong>${escape(f.amountFormatted)}</strong> refund is officially back in your balance.</p>
<p style="margin:0 0 16px;font-size:15px;color:#a1a1aa;">We got you this one for free to show you the power of Refyndra AI. We wanted to prove one thing: your money shouldn't be lost as long as Refyndra is watching your back. This refund was on us so you could experience the true potential of our AI.</p>
<p style="margin:0 0 16px;font-size:15px;">To keep the bot hunting for refunds 24/7 and catching every delay for all your future orders, upgrade to Pro now:</p>
<p style="margin:0 0 8px;font-size:15px;"><strong>Monthly Pro:</strong> ${escape(f.monthlyPriceDisplay)} — so this subscription literally pays for itself!*</p>
<p style="margin:0 0 20px;font-size:15px;"><strong>Annual (best value):</strong> ${escape(f.annualPriceDisplay)} (Save 25%!)</p>
<p style="margin:0 0 20px;font-size:15px;">Don't let another refund slip away. Keep your protection active!</p>
<p style="margin:0;">
  <a href="${escape(f.upgradeUrl)}" style="display:inline-block;background:#34d399;color:#052e16;font-weight:600;padding:12px 20px;border-radius:8px;text-decoration:none;">Upgrade to Pro</a>
</p>
<p style="margin:24px 0 0;font-size:11px;color:#71717a;">*Outcomes depend on merchant policies; not a guarantee of future refunds.</p>
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
    process.env.NEXT_PUBLIC_PRO_MONTHLY_DISPLAY?.trim() || '$9.99/month';
  const annual = process.env.NEXT_PUBLIC_PRO_ANNUAL_DISPLAY?.trim() || '$89.99/year';
  const base = siteUrl.replace(/\/$/, '');
  return {
    userDisplayName,
    platformLabel,
    amountFormatted: formatUsd(amountCents),
    monthlyPriceDisplay: monthly,
    annualPriceDisplay: annual,
    upgradeUrl: `${base}/upgrade`,
    pricingUrl: `${base}/pricing`,
  };
}
