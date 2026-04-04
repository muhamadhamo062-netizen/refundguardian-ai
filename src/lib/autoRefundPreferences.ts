/**
 * Optional auto-refund *assistance* preferences (client-side). OFF by default.
 * Does not execute refunds or bypass auth — only drives UI + transparent activity log.
 */

import type { RefundIssueType, RefundPlatform } from '@/lib/refundPriorityEngine';

const PREFS_KEY = 'rg_auto_refund_prefs_v1';
const LOG_KEY = 'rg_auto_refund_activity_v1';
const MAX_LOG = 40;

export type PlatformAutoPrefs = {
  /** Master switch for this platform (default OFF). */
  enabled: boolean;
  /** Per issue-type opt-in (e.g. late_delivery → true). */
  issueTypes: Partial<Record<RefundIssueType, boolean>>;
};

export type AutoRefundPrefs = Record<RefundPlatform, PlatformAutoPrefs>;

export function defaultAutoRefundPrefs(): AutoRefundPrefs {
  return {
    amazon: { enabled: false, issueTypes: {} },
    uber_eats: { enabled: false, issueTypes: {} },
    uber_rides: { enabled: false, issueTypes: {} },
    doordash: { enabled: false, issueTypes: {} },
  };
}

function mergePrefs(raw: Partial<AutoRefundPrefs> | null): AutoRefundPrefs {
  const d = defaultAutoRefundPrefs();
  if (!raw) return d;
  for (const k of Object.keys(d) as RefundPlatform[]) {
    const p = raw[k];
    if (!p || typeof p !== 'object') continue;
    d[k] = {
      enabled: Boolean(p.enabled),
      issueTypes: { ...(p.issueTypes && typeof p.issueTypes === 'object' ? p.issueTypes : {}) },
    };
  }
  return d;
}

export function loadAutoRefundPrefs(): AutoRefundPrefs {
  if (typeof window === 'undefined') return defaultAutoRefundPrefs();
  try {
    const s = window.localStorage.getItem(PREFS_KEY);
    if (!s) return defaultAutoRefundPrefs();
    const parsed = JSON.parse(s) as Partial<AutoRefundPrefs>;
    return mergePrefs(parsed);
  } catch {
    return defaultAutoRefundPrefs();
  }
}

export function saveAutoRefundPrefs(prefs: AutoRefundPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota */
  }
}

export function setPlatformAutoEnabled(
  prefs: AutoRefundPrefs,
  platform: RefundPlatform,
  enabled: boolean
): AutoRefundPrefs {
  return {
    ...prefs,
    [platform]: { ...prefs[platform], enabled },
  };
}

export function setIssueTypeAutoEnabled(
  prefs: AutoRefundPrefs,
  platform: RefundPlatform,
  issue: RefundIssueType,
  on: boolean
): AutoRefundPrefs {
  const cur = prefs[platform];
  return {
    ...prefs,
    [platform]: {
      ...cur,
      issueTypes: { ...cur.issueTypes, [issue]: on },
    },
  };
}

export function isAutoRefundActiveForRow(
  prefs: AutoRefundPrefs,
  platform: RefundPlatform,
  issue: RefundIssueType
): boolean {
  const p = prefs[platform];
  if (!p.enabled) return false;
  return p.issueTypes[issue] === true;
}

export type AutoRefundActivityEntry = {
  at: string;
  orderId: string;
  platform: RefundPlatform;
  issue_type: RefundIssueType;
  message: string;
};

export function appendAutoRefundActivity(entry: Omit<AutoRefundActivityEntry, 'at'>): void {
  if (typeof window === 'undefined') return;
  try {
    const at = new Date().toISOString();
    const prev = loadAutoRefundActivity();
    const next = [{ ...entry, at }, ...prev].slice(0, MAX_LOG);
    window.localStorage.setItem(LOG_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function loadAutoRefundActivity(): AutoRefundActivityEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const s = window.localStorage.getItem(LOG_KEY);
    if (!s) return [];
    const arr = JSON.parse(s) as AutoRefundActivityEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
