import { Resend } from 'resend';

import {
  buildRefundEmailHtml,
  buildRefundEmailSubject,
  buildRefundEmailText,
  mergeFieldsFromNotificationData,
  type RefundSuccessMergeFields,
} from '@/lib/email/refundSuccessTemplates';
import { getPublicSiteUrl } from '@/lib/siteUrl';

export async function sendRefundSuccessEmail(opts: {
  to: string;
  merge: RefundSuccessMergeFields;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || 'onboarding@resend.dev';

  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY not configured' };
  }

  const resend = new Resend(apiKey);
  const subject = buildRefundEmailSubject(opts.merge.platformLabel);

  const { error } = await resend.emails.send({
    from: `Refyndra AI <${from}>`,
    to: opts.to,
    subject,
    text: buildRefundEmailText(opts.merge),
    html: buildRefundEmailHtml(opts.merge),
  });

  if (error) {
    return { ok: false, error: typeof error.message === 'string' ? error.message : 'Resend error' };
  }
  return { ok: true };
}

export function mergeFromNotificationData(
  data: Record<string, unknown> | null | undefined
): RefundSuccessMergeFields | null {
  const site = getPublicSiteUrl();
  return mergeFieldsFromNotificationData(data, site);
}
