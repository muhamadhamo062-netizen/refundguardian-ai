/**
 * RefundRadar / RefundGuardian — reusable priority scoring for UI + future API use.
 * Higher score = higher priority in dashboards.
 */

export type RefundPlatform = 'amazon' | 'uber_eats' | 'uber_rides' | 'doordash';

export type RefundIssueType =
  | 'missing_item'
  | 'charged_incorrectly'
  | 'late_delivery'
  | 'trip_issue'
  | 'quality_issue'
  | 'unknown';

export type PriorityBadgeLabel = 'HIGH VALUE' | 'FAST' | 'MEDIUM' | 'LOW EFFORT';

export type RefundPriorityResult = {
  priority_score: number;
  label: PriorityBadgeLabel;
  platform: RefundPlatform;
  issue_type: RefundIssueType;
};

const SCORE_MATRIX: Record<
  RefundPlatform,
  Partial<Record<RefundIssueType, number>>
> = {
  amazon: {
    missing_item: 100,
    charged_incorrectly: 84,
    late_delivery: 76,
    unknown: 60,
  },
  uber_eats: {
    late_delivery: 96,
    missing_item: 78,
    charged_incorrectly: 88,
    quality_issue: 55,
    unknown: 58,
  },
  uber_rides: {
    charged_incorrectly: 94,
    trip_issue: 81,
    late_delivery: 70,
    unknown: 55,
  },
  doordash: {
    late_delivery: 95,
    missing_item: 79,
    charged_incorrectly: 87,
    quality_issue: 56,
    unknown: 58,
  },
};

function labelFor(
  platform: RefundPlatform,
  issue: RefundIssueType,
  score: number
): PriorityBadgeLabel {
  if (issue === 'missing_item' && platform === 'amazon') return 'HIGH VALUE';
  if (issue === 'charged_incorrectly' && platform === 'uber_rides') return 'HIGH VALUE';
  if (issue === 'late_delivery' && platform === 'uber_eats') return 'FAST';
  if (issue === 'late_delivery' && platform === 'amazon') return 'FAST';
  if (issue === 'quality_issue' && (platform === 'uber_eats' || platform === 'doordash')) return 'MEDIUM';
  if (score >= 85) return 'HIGH VALUE';
  if (score >= 75) return 'FAST';
  if (score >= 65) return 'MEDIUM';
  return 'LOW EFFORT';
}

export function getRefundPriority(input: {
  platform: RefundPlatform;
  issue_type: RefundIssueType;
}): RefundPriorityResult {
  const { platform, issue_type } = input;
  const issue: RefundIssueType =
    issue_type === 'unknown' ? 'unknown' : issue_type;
  const raw =
    SCORE_MATRIX[platform]?.[issue] ??
    SCORE_MATRIX[platform]?.unknown ??
    50;
  const priority_score = Math.min(100, Math.max(0, raw));
  return {
    priority_score,
    label: labelFor(platform, issue, priority_score),
    platform,
    issue_type: issue,
  };
}

/** Map API / row provider string to platform bucket. */
export function inferPlatformFromProvider(
  provider: string | undefined | null
): RefundPlatform {
  const p = (provider ?? '').toLowerCase();
  if (p.includes('doordash')) return 'doordash';
  if (p.includes('uber_eats') || p.includes('ubereats') || p.includes('eats'))
    return 'uber_eats';
  if (p.includes('uber') && !p.includes('eats')) return 'uber_rides';
  return 'amazon';
}

/**
 * Heuristic from synced row text (product line + optional status from extension).
 * Does not change ingestion — UI-only classification.
 */
export function inferIssueTypeFromRow(input: {
  productName: string;
  status?: string | null;
  provider?: string | null;
}): RefundIssueType {
  const blob = `${input.productName ?? ''} ${input.status ?? ''}`.toLowerCase();
  const platform = inferPlatformFromProvider(input.provider);

  if (platform === 'uber_eats' || platform === 'doordash') {
    if (/cold|soggy|bad quality|spoiled|inedible|wrong temp|temperature|stale|mushy/i.test(blob))
      return 'quality_issue';
  }

  if (platform === 'uber_rides') {
    if (/cancel|driver|route|wrong stop|trip|fare/i.test(blob)) return 'trip_issue';
    if (/charg|bill|duplicate|wrong|incorrect|overcharg/i.test(blob))
      return 'charged_incorrectly';
    return 'unknown';
  }

  if (/missing|not received|never arrived|empty|wrong item/i.test(blob))
    return 'missing_item';
  if (/charg|wrong price|duplicate|incorrect|refund|billing/i.test(blob))
    return 'charged_incorrectly';
  if (/late|delay|not delivered|slow|behind/i.test(blob)) return 'late_delivery';

  if (platform === 'uber_eats' || platform === 'doordash') return 'late_delivery';
  if (platform === 'amazon') return 'late_delivery';
  return 'unknown';
}
