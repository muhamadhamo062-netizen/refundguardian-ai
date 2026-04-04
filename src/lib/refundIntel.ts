/**
 * Advisory refund intelligence labels (UI + sorting). Does not change ingestion or APIs.
 */

import type { RefundIssueType, RefundPlatform } from '@/lib/refundPriorityEngine';

export type RefundIntelTier =
  | 'critical_financial'
  | 'high_value'
  | 'fast'
  | 'medium'
  | 'manual_review';

export type RefundIntel = {
  tier: RefundIntelTier;
  /** Short label for dashboard chips */
  displayLabel: string;
  /** Relative ordering: higher = surface first */
  tierRank: number;
};

const TIER_RANK: Record<RefundIntelTier, number> = {
  critical_financial: 5,
  high_value: 4,
  fast: 3,
  medium: 2,
  manual_review: 1,
};

function blob(input: { productName: string; status?: string | null }): string {
  return `${input.productName ?? ''} ${input.status ?? ''}`.toLowerCase();
}

function hasFinancialCriticalSignals(s: string): boolean {
  return /overcharg|over charge|extra fee|hidden fee|duplicate charg|wrong total|billing error|fee error|tax error|double charg/i.test(
    s
  );
}

/**
 * Classifies each order row for display + smart ranking (HIGH VALUE / delivery / financial).
 */
export function analyzeRefundIntel(input: {
  platform: RefundPlatform;
  issue_type: RefundIssueType;
  productName: string;
  status?: string | null;
}): RefundIntel {
  const { platform, issue_type } = input;
  const b = blob(input);

  if (platform === 'amazon') {
    if (issue_type === 'missing_item') {
      return {
        tier: 'high_value',
        displayLabel: 'HIGH VALUE REFUND',
        tierRank: TIER_RANK.high_value,
      };
    }
    if (issue_type === 'charged_incorrectly') {
      if (hasFinancialCriticalSignals(b)) {
        return {
          tier: 'critical_financial',
          displayLabel: 'CRITICAL FINANCIAL REFUND',
          tierRank: TIER_RANK.critical_financial,
        };
      }
      return {
        tier: 'high_value',
        displayLabel: 'BILLING ERROR (HIGH VALUE)',
        tierRank: TIER_RANK.high_value,
      };
    }
    if (issue_type === 'late_delivery') {
      return {
        tier: 'fast',
        displayLabel: 'STANDARD REFUND',
        tierRank: TIER_RANK.fast,
      };
    }
    return {
      tier: 'medium',
      displayLabel: 'REVIEW',
      tierRank: TIER_RANK.medium,
    };
  }

  if (platform === 'uber_eats' || platform === 'doordash') {
    if (issue_type === 'quality_issue') {
      return {
        tier: 'manual_review',
        displayLabel: 'MANUAL REVIEW',
        tierRank: TIER_RANK.manual_review,
      };
    }
    if (issue_type === 'late_delivery') {
      return {
        tier: 'fast',
        displayLabel: 'FAST REFUND',
        tierRank: TIER_RANK.fast,
      };
    }
    if (issue_type === 'missing_item') {
      return {
        tier: 'medium',
        displayLabel: 'MEDIUM REFUND',
        tierRank: TIER_RANK.medium,
      };
    }
    if (issue_type === 'charged_incorrectly') {
      return {
        tier: 'high_value',
        displayLabel: 'HIGH VALUE',
        tierRank: TIER_RANK.high_value,
      };
    }
    return {
      tier: 'medium',
      displayLabel: 'REVIEW',
      tierRank: TIER_RANK.medium,
    };
  }

  // uber_rides
  if (issue_type === 'charged_incorrectly') {
    if (hasFinancialCriticalSignals(b)) {
      return {
        tier: 'critical_financial',
        displayLabel: 'CRITICAL FINANCIAL REFUND',
        tierRank: TIER_RANK.critical_financial,
      };
    }
    return {
      tier: 'high_value',
      displayLabel: 'HIGH VALUE',
      tierRank: TIER_RANK.high_value,
    };
  }
  if (issue_type === 'trip_issue') {
    return {
      tier: 'fast',
      displayLabel: 'STANDARD REFUND',
      tierRank: TIER_RANK.fast,
    };
  }
  if (issue_type === 'late_delivery') {
    return {
      tier: 'fast',
      displayLabel: 'STANDARD REFUND',
      tierRank: TIER_RANK.fast,
    };
  }
  return {
    tier: 'medium',
    displayLabel: 'REVIEW',
    tierRank: TIER_RANK.medium,
  };
}

export function intelTierBadgeClass(tier: RefundIntelTier): string {
  if (tier === 'critical_financial')
    return 'bg-rose-500/15 text-rose-200 ring-rose-500/40';
  if (tier === 'high_value') return 'bg-amber-500/15 text-amber-200 ring-amber-500/35';
  if (tier === 'fast') return 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/35';
  if (tier === 'manual_review') return 'bg-violet-500/15 text-violet-200 ring-violet-500/40';
  return 'bg-zinc-500/15 text-zinc-200 ring-zinc-500/30';
}
