import OpenAI from 'openai';
import type { RefundIssueType, RefundPlatform } from '@/lib/refundPriorityEngine';

function platformLabel(p: RefundPlatform): string {
  switch (p) {
    case 'uber_eats':
      return 'Uber Eats';
    case 'uber_rides':
      return 'Uber Rides';
    case 'doordash':
      return 'DoorDash';
    default:
      return 'Amazon';
  }
}

/** Maps dashboard issue types to concrete lines for the model. */
export function refundIssueToComplaintLines(
  issue: RefundIssueType,
  productName?: string | null
): string[] {
  const orderLine =
    productName && productName.trim().length > 0
      ? `Order / item context: ${productName.trim()}`
      : null;
  const base: string[] = [];
  switch (issue) {
    case 'missing_item':
      base.push('An item was missing or the order arrived incomplete versus what was purchased.');
      break;
    case 'charged_incorrectly':
      base.push('Billing appears incorrect (duplicate charge, wrong amount, or unexpected fee).');
      break;
    case 'late_delivery':
      base.push('Delivery or fulfillment was unreasonably late relative to the commitment.');
      break;
    case 'trip_issue':
      base.push('The trip experience did not match what was reasonably expected (service quality / routing).');
      break;
    case 'quality_issue':
      base.push('Food or goods quality was below reasonable expectations (temperature, freshness, or condition).');
      break;
    default:
      base.push('There was a problem with this order that warrants a good-faith review and resolution.');
  }
  if (orderLine) base.push(orderLine);
  return base;
}

export type GenerateComplaintParams = {
  platform: RefundPlatform;
  issues: string[];
  /** Stable seed (e.g. order_id) so tone rotates per order but stays stable per refresh. */
  toneSeed?: string;
  context?: string;
  model?: string;
};

/**
 * Primary OpenAI-backed complaint body for RefundGuardian — advisory copy only.
 * Uses `process.env.OPENAI_API_KEY`; throws if missing.
 */
export async function generateStructuredComplaint(params: GenerateComplaintParams): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY missing');
  }

  const model = params.model?.trim() || 'gpt-4o-mini';
  const pLabel = platformLabel(params.platform);
  const issuesBlock = params.issues.filter(Boolean).join('\n- ');
  const extra = params.context?.trim() ? `\nAdditional context:\n${params.context.trim()}` : '';

  const system = `You write escalation-ready, high-pressure U.S. consumer dispute letters that read like top-tier counsel — but are written in the customer's voice.
Hard rules:
- Do NOT claim to be an attorney and do NOT provide legal advice. Write as the customer.
- No hallucinations: do NOT invent facts, amounts, dates, policy names, or internal ticket numbers.
- You MAY reference general legal concepts by name (e.g., "unfair or deceptive practices", "chargeback rights", "good-faith business practices"), but do NOT cite statute numbers, sections, case law, or jurisdiction-specific guarantees.
- Do NOT accuse the company or any individual of crimes, fraud, or bad faith. Stick to verifiable facts and reasonable consumer expectations.
- Never mention AI, automation, models, prompts, or internal tools.
- Tone: calm, surgical, and assertive. No insults, no begging.
- Output ONLY the letter body (no subject line, no markdown, no headers like "Subject:").
Style requirements:
- Short paragraphs, strong verbs, crisp demands.
- Use a small bullet list for facts.
- Include a clear deadline and a formal notice of escalation (BBB / state AG / payment dispute) as stated intent.
- Ask for a written final position if the request is denied and the specific basis relied on.`;

  const user = `Write a formal dispute/complaint letter to ${pLabel} Support. Goal: maximum refund/credit with fast resolution.

Required components (in this order):
1) Notice of dispute + preservation of rights (no waiver).
2) Facts (bulleted, concise).
3) Why this is unacceptable (service failure / nonconforming performance / billing integrity).
4) Demand (specific remedies).
5) Deadline (business days) and next steps if not resolved.

Constraints:
- Do NOT include a mailing address or phone number.
- Close with "[Your Name]".
- If a time/fulfillment promise was missed, state it as a failure to meet the promised timeframe / contracted expectation.
- Include rights-aware language used by top U.S. consumer counsel: "formal notice of dispute", "good-faith review", "billing integrity", "material service failure", "not as represented", "preserve all records", "written final position", "chargeback/payment dispute", "state Attorney General", "BBB".
- Keep it tight and scannable (about 190–260 words).
- Use a firm but reasonable deadline of 5 business days unless the facts block explicitly implies a different urgency.

Facts to incorporate as bullets (do not add new facts):
- ${issuesBlock}
${extra}

Demand:
- Full refund OR a credit that reasonably matches the harm, plus reversal of any fees tied to the failure.`;

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.25,
    max_tokens: 650,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim() || '';
  if (!text) {
    throw new Error('Empty complaint from model');
  }
  return text;
}

export async function generateComplaintForRefundOrder(input: {
  platform: RefundPlatform;
  issue_type: RefundIssueType;
  order_id: string;
  productName?: string | null;
  model?: string;
}): Promise<string> {
  const issues = refundIssueToComplaintLines(input.issue_type, input.productName);
  return generateStructuredComplaint({
    platform: input.platform,
    issues,
    toneSeed: `${input.order_id}:${input.issue_type}`,
    context: `Reference order id: ${input.order_id}`,
    model: input.model,
  });
}
