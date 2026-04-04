/**
 * Pre–OpenAI guidance copy + estimates for the Priority Engine table (desktop).
 * Server and client both import for consistent logging and previews.
 */

import { getRefundPriority, type RefundIssueType, type RefundPlatform } from '@/lib/refundPriorityEngine';

export type GuidancePlatformKey = 'amazon' | 'uber_eats' | 'uber_rides';

export function platformKeyToProvider(key: GuidancePlatformKey): 'amazon' | 'uber_eats' | 'uber' {
  if (key === 'uber_rides') return 'uber';
  return key;
}

export function autoIssueForPlatform(key: GuidancePlatformKey): RefundIssueType {
  if (key === 'amazon') return 'missing_item';
  if (key === 'uber_eats') return 'late_delivery';
  return 'charged_incorrectly';
}

/** Allowed optional issues per platform (ranks 2–3); Uber Rides has no #3. */
export const OPTIONAL_ISSUES_BY_PLATFORM: Record<
  GuidancePlatformKey,
  { rank2: RefundIssueType; rank3: RefundIssueType | null }
> = {
  amazon: { rank2: 'charged_incorrectly', rank3: 'late_delivery' },
  uber_eats: { rank2: 'missing_item', rank3: 'charged_incorrectly' },
  uber_rides: { rank2: 'trip_issue', rank3: null },
};

const AUTO_BODY: Record<GuidancePlatformKey, string> = {
  amazon:
    '[Auto — system] Missing item / partial shipment: this order is flagged for automatic compensation review. Please verify shipment contents against the order line items and apply the standard missing-item or partial credit policy where applicable.',
  uber_eats:
    '[Auto — system] Late delivery: this delivery missed the expected arrival window. Please review service recovery / credit per your late-delivery policy for this order.',
  uber_rides:
    '[Auto — system] Charged incorrectly: fare or fees on this trip do not match the quoted route or promotions. Please audit the trip receipt and adjust charges or issue account credit as appropriate.',
};

const OPTIONAL_PLACEHOLDER: Partial<Record<RefundIssueType, string>> = {
  charged_incorrectly:
    '[Placeholder — optional] I was charged incorrectly for this order. Please review the itemized receipt and correct any duplicate, wrong, or unexpected charges.',
  late_delivery:
    '[Placeholder — optional] This order arrived later than promised. Please review the delivery timeline and apply appropriate compensation per your policy.',
  missing_item:
    '[Placeholder — optional] One or more items from my order were missing. Please verify the order contents and issue a refund or credit for the missing items.',
  trip_issue:
    '[Placeholder — optional] I experienced a delay or issue during this trip (route, wait time, or service). Please review the trip details and apply fair resolution or credit.',
  quality_issue:
    '[Placeholder — optional] The food quality was unacceptable (e.g. cold, wrong temperature, or inedible). Please review and apply appropriate compensation per your policy.',
};

export function optionalPlaceholder(issue: RefundIssueType): string {
  return OPTIONAL_PLACEHOLDER[issue] ?? `[Placeholder — optional] Issue type: ${issue}. (AI message generation will replace this.)`;
}

export function estimateRefundUsd(platform: RefundPlatform, issue: RefundIssueType): number {
  const { priority_score } = getRefundPriority({ platform, issue_type: issue });
  const base = 4 + (priority_score / 100) * 42;
  return Math.round(base * 100) / 100;
}

export function buildLoggedMessage(input: {
  platform: GuidancePlatformKey;
  auto_issue: RefundIssueType;
  optional_issues: RefundIssueType[];
}): string {
  const parts: string[] = [AUTO_BODY[input.platform]];
  for (const iss of input.optional_issues) {
    parts.push(optionalPlaceholder(iss));
  }
  return parts.join('\n\n');
}

export function resolveOptionalIssuesFromFlags(
  key: GuidancePlatformKey,
  two: boolean,
  three: boolean
): RefundIssueType[] {
  const o = OPTIONAL_ISSUES_BY_PLATFORM[key];
  const out: RefundIssueType[] = [];
  if (two) out.push(o.rank2);
  if (three && o.rank3) out.push(o.rank3);
  return out;
}

/** Modal preview for optional column only (placeholder; not written until Confirm on row). */
export function guidanceDraftOptional(input: {
  platform: RefundPlatform;
  issue: RefundIssueType;
}): {
  refund_score: number;
  priority: 'HIGH VALUE' | 'FAST' | 'MEDIUM';
  estimated_refund: number;
  reason: string;
  claim_message: string;
} {
  const primary = getRefundPriority({ platform: input.platform, issue_type: input.issue });
  const est = estimateRefundUsd(input.platform, input.issue);
  const priorityLabel =
    primary.label === 'HIGH VALUE' || primary.label === 'FAST' || primary.label === 'MEDIUM'
      ? primary.label
      : 'MEDIUM';
  return {
    refund_score: primary.priority_score,
    priority: priorityLabel,
    estimated_refund: est,
    reason: 'Placeholder draft for optional issue (pre-OpenAI).',
    claim_message: optionalPlaceholder(input.issue),
  };
}

export function guidancePreview(input: {
  platform: RefundPlatform;
  auto_issue: RefundIssueType;
  optional_issues: RefundIssueType[];
}): {
  refund_score: number;
  priority: 'HIGH VALUE' | 'FAST' | 'MEDIUM';
  estimated_refund: number;
  reason: string;
  claim_message: string;
} {
  const primary = getRefundPriority({ platform: input.platform, issue_type: input.auto_issue });
  const est = estimateRefundUsd(input.platform, input.auto_issue);
  const msg = buildLoggedMessage({
    platform: input.platform as GuidancePlatformKey,
    auto_issue: input.auto_issue,
    optional_issues: input.optional_issues,
  });
  const priorityLabel =
    primary.label === 'HIGH VALUE' || primary.label === 'FAST' || primary.label === 'MEDIUM'
      ? primary.label
      : 'MEDIUM';
  return {
    refund_score: primary.priority_score,
    priority: priorityLabel,
    estimated_refund: est,
    reason: `Pre-OpenAI advisory — primary issue: ${input.auto_issue.replace(/_/g, ' ')}. Optional drafts included when selected.`,
    claim_message: msg,
  };
}
