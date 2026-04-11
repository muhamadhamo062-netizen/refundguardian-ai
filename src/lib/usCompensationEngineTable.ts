/**
 * Autonomous Compensation Engine — one row per US merchant platform (desktop table).
 */

import type { RefundIssueType, RefundPlatform } from '@/lib/refundPriorityEngine';

export type UsMerchantPlatformId = 'amazon' | 'uber_eats' | 'uber_rides' | 'doordash';

export type AceOptionalColumn = {
  label: string;
  issueType: RefundIssueType;
};

export type AceTableRow = {
  id: UsMerchantPlatformId;
  emoji: string;
  platformLabel: string;
  domain: string;
  category: string;
  /** Automatic delay lane (silent processing) */
  auto: { title: string; issueType: RefundIssueType };
  optional2: AceOptionalColumn;
  optional3: AceOptionalColumn;
};

/** Matrix row for `getRefundPriority`. */
export function priorityMatrixPlatform(id: UsMerchantPlatformId): RefundPlatform {
  if (id === 'doordash') return 'doordash';
  if (id === 'uber_rides') return 'uber_rides';
  if (id === 'uber_eats') return 'uber_eats';
  return 'amazon';
}

export const ACE_TABLE_ROWS: readonly AceTableRow[] = [
  {
    id: 'amazon',
    emoji: '📦',
    platformLabel: 'Amazon',
    domain: 'amazon.com',
    category: 'Retail & marketplace',
    auto: { title: 'Automatic delay', issueType: 'late_delivery' },
    optional2: { label: 'Missing item', issueType: 'missing_item' },
    optional3: { label: 'Charged incorrectly', issueType: 'charged_incorrectly' },
  },
  {
    id: 'uber_eats',
    emoji: '🍔',
    platformLabel: 'Uber Eats',
    domain: 'ubereats.com',
    category: 'Food delivery',
    auto: { title: 'Automatic delay', issueType: 'late_delivery' },
    optional2: { label: 'Missing item', issueType: 'missing_item' },
    optional3: { label: 'Cold food', issueType: 'quality_issue' },
  },
  {
    id: 'uber_rides',
    emoji: '🚗',
    platformLabel: 'Uber Rides',
    domain: 'uber.com',
    category: 'Mobility',
    auto: { title: 'Automatic delay', issueType: 'trip_issue' },
    optional2: { label: 'Charged incorrectly', issueType: 'charged_incorrectly' },
    optional3: { label: 'Trip / route issue', issueType: 'trip_issue' },
  },
  {
    id: 'doordash',
    emoji: '🥡',
    platformLabel: 'DoorDash',
    domain: 'doordash.com',
    category: 'Food delivery',
    auto: { title: 'Automatic delay', issueType: 'late_delivery' },
    optional2: { label: 'Missing item', issueType: 'missing_item' },
    optional3: { label: 'Overcharge / wrong charge', issueType: 'charged_incorrectly' },
  },
] as const;
