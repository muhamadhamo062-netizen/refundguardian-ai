'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  type RefundIssueType,
  type RefundPlatform,
  getRefundPriority,
  inferIssueTypeFromRow,
  inferPlatformFromProvider,
} from '@/lib/refundPriorityEngine';
import type { RefundDecisionOutput } from '@/lib/ai/refundDecision.types';
import { analyzeRefundIntel } from '@/lib/refundIntel';
import {
  appendAutoRefundActivity,
  defaultAutoRefundPrefs,
  isAutoRefundActiveForRow,
  loadAutoRefundActivity,
  loadAutoRefundPrefs,
  saveAutoRefundPrefs,
  setIssueTypeAutoEnabled,
  setPlatformAutoEnabled,
  type AutoRefundActivityEntry,
  type AutoRefundPrefs,
} from '@/lib/autoRefundPreferences';
import { PRO_AI_ORDER_LIMIT } from '@/lib/billing/plan';
import { PlatformOrderIcon } from '@/components/dashboard/PlatformOrderIcon';

export type UnifiedOrderRow = {
  id: string;
  orderId: string;
  productName: string;
  price: string;
  date: string;
  backendStatus: 'ok' | 'failed' | 'pending';
  extractedAt: string;
  source: 'database' | 'extension';
  /** Present when row comes from GET /api/orders (database) */
  provider?: string;
  /** Optional line from extension extraction (used for AI issue inference) */
  status?: string;
};

type ExtensionSnapshot = {
  id?: string;
  orders?: Array<{
    orderId?: string;
    productTitle?: string;
    price?: string;
    date?: string;
    status?: string;
  }>;
  url?: string;
  extractedAt?: string;
  backendStatus?: string;
  receivedAt?: string;
};

function normalizeBackendStatus(s: string | undefined): 'ok' | 'failed' | 'pending' {
  if (s === 'ok') return 'ok';
  if (s === 'failed') return 'failed';
  return 'pending';
}

function flattenExtensionSnapshots(
  snapshots: ExtensionSnapshot[] | null | undefined
): UnifiedOrderRow[] {
  if (!Array.isArray(snapshots)) return [];
  const out: UnifiedOrderRow[] = [];
  for (const snap of snapshots) {
    const orders = snap.orders || [];
    const st = normalizeBackendStatus(snap.backendStatus);
    const extAt = snap.extractedAt || snap.receivedAt || '';
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      const oid = o.orderId?.trim() || '';
      out.push({
        id: `ext-${snap.id ?? 'snap'}-${oid || i}-${i}`,
        orderId: oid || '—',
        productName: o.productTitle?.trim() || '—',
        price: o.price?.trim() || '—',
        date: o.date?.trim() || '—',
        backendStatus: st,
        extractedAt: extAt,
        source: 'extension',
        provider: 'amazon',
        status: o.status,
      });
    }
  }
  return out;
}

function mergeRows(db: UnifiedOrderRow[], ext: UnifiedOrderRow[]): UnifiedOrderRow[] {
  const seen = new Set<string>();
  const merged: UnifiedOrderRow[] = [];
  for (const r of db) {
    merged.push(r);
    if (r.orderId && r.orderId !== '—') seen.add(r.orderId);
  }
  for (const r of ext) {
    if (r.orderId && r.orderId !== '—' && seen.has(r.orderId)) continue;
    merged.push(r);
  }
  return merged;
}

type FilterMode = 'all' | 'success' | 'failed';

function parsePriceToAmount(price: string): number | null {
  if (!price || price === '—') return null;
  const s = String(price).replace(/,/g, '');
  const m = s.match(/([\d.]+)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isNaN(n) ? null : n;
}

function isOrdersTableMissingMessage(msg: string | undefined): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return m.includes('orders table missing') || (m.includes('does not exist') && m.includes('orders'));
}

/** Client-side extension of AI output; `manual_required` is optional on API payloads (UI only). */
type AiDecisionRow = RefundDecisionOutput & { manual_required?: boolean };

export type AmazonOrdersDashboardProps = {
  /** AI advisory batch limit (from subscription tier). */
  maxAiOrdersPerBatch?: number;
  isPro?: boolean;
  /** Server-persisted autonomous flag (Pro). */
  serverAutonomousMode?: boolean;
  /** Free user has used the one-time AI scan (server flag). */
  trialScanLocked?: boolean;
};

export function AmazonOrdersDashboard({
  maxAiOrdersPerBatch = PRO_AI_ORDER_LIMIT,
  isPro = false,
  serverAutonomousMode = false,
  trialScanLocked = false,
}: AmazonOrdersDashboardProps = {}) {
  const router = useRouter();
  const [rows, setRows] = useState<UnifiedOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');
  // Default off: avoids aggressive polling that can make the dashboard feel laggy on navigation.
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [extensionHint, setExtensionHint] = useState<string | null>(null);
  const [aiById, setAiById] = useState<Record<string, AiDecisionRow>>({});
  const [autoPrefs, setAutoPrefs] = useState<AutoRefundPrefs>(defaultAutoRefundPrefs);
  const [activityLog, setActivityLog] = useState<AutoRefundActivityEntry[]>([]);
  const [showActivity, setShowActivity] = useState(false);
  const [aiPlanHint, setAiPlanHint] = useState<string | null>(null);
  const [trialLockedClient, setTrialLockedClient] = useState(false);
  const autoAssistLoggedRef = useRef<Set<string>>(new Set());
  const serverAutomationLoggedRef = useRef<Set<string>>(new Set());

  const aiLocked = trialScanLocked || trialLockedClient;

  useEffect(() => {
    setAutoPrefs(loadAutoRefundPrefs());
    setActivityLog(loadAutoRefundActivity());
  }, []);

  const updatePlatformAuto = useCallback((p: RefundPlatform, v: boolean) => {
    setAutoPrefs((cur) => {
      const next = setPlatformAutoEnabled(cur, p, v);
      saveAutoRefundPrefs(next);
      return next;
    });
  }, []);

  const updateIssueAuto = useCallback((p: RefundPlatform, issue: RefundIssueType, v: boolean) => {
    setAutoPrefs((cur) => {
      const next = setIssueTypeAutoEnabled(cur, p, issue, v);
      saveAutoRefundPrefs(next);
      return next;
    });
    if (v) {
      appendAutoRefundActivity({
        orderId: '—',
        platform: p,
        issue_type: issue,
        message: 'You turned on extra savings signals for this issue type.',
      });
      setActivityLog(loadAutoRefundActivity());
    }
  }, []);

  const requestExtensionStorage = useCallback(
    async (options?: { suppressExtensionHints?: boolean }) => {
      if (typeof window === 'undefined') return [];
      const suppressExtensionHints = options?.suppressExtensionHints === true;

      const isLocal =
        typeof window !== 'undefined' &&
        /localhost|127\.0\.0\.1/.test(window.location.hostname);

      const once = () =>
        new Promise<{
          bridgeReceived: boolean;
          payload: ExtensionSnapshot[] | null | undefined;
          error?: string;
        }>((resolve) => {
          const t = window.setTimeout(
            () => resolve({ bridgeReceived: false, payload: null }),
            4000
          );
          function onMessage(e: MessageEvent) {
            if (e.data?.type !== 'RG_AMAZON_ORDERS_RESPONSE') return;
            window.clearTimeout(t);
            window.removeEventListener('message', onMessage);
            resolve({
              bridgeReceived: Boolean(e.data.bridge),
              payload: e.data.payload as ExtensionSnapshot[] | null | undefined,
              error:
                typeof e.data.error === 'string' ? e.data.error : undefined,
            });
          }
          window.addEventListener('message', onMessage);
          window.postMessage({ type: 'RG_REQUEST_AMAZON_ORDERS' }, '*');
        });

      let result = await once();
      if (!result.bridgeReceived && isLocal) {
        await new Promise((r) => setTimeout(r, 500));
        result = await once();
      }
      if (!result.bridgeReceived && isLocal) {
        await new Promise((r) => setTimeout(r, 600));
        result = await once();
      }

      // Content script answered: empty storage is valid — do not show "storage not detected"
      if (result.bridgeReceived) {
        if (!suppressExtensionHints) {
          if (result.error === 'no_extension_storage') {
            setExtensionHint('Refyndra couldn’t connect — refresh this page with the extension turned on.');
          } else if (result.error) {
            setExtensionHint(result.error);
          } else {
            setExtensionHint(null);
          }
        } else {
          setExtensionHint(null);
        }
        const arr = Array.isArray(result.payload) ? result.payload : [];
        return flattenExtensionSnapshots(arr);
      }

      // No answer from extension — only nag when DB is healthy (otherwise DB warning is the real fix)
      if (isLocal && !suppressExtensionHints) {
        setExtensionHint(
          (h) =>
            h ??
            'Add the Refyndra browser extension, then refresh this page so we can sync your orders.'
        );
      }
      return [];
    },
    []
  );

  const load = useCallback(async () => {
    setError(null);
    setWarning(null);
    setExtensionHint(null);
    setLoading(true);
    let dbRows: UnifiedOrderRow[] = [];
    let apiMessage: string | null = null;

    let healthDb: 'connected' | 'missing_table' | 'error' | 'unknown' = 'unknown';
    try {
      const hr = await fetch('/api/health', { cache: 'no-store' });
      const hb = (await hr.json().catch(() => ({}))) as { db?: string };
      if (hb.db === 'connected' || hb.db === 'missing_table' || hb.db === 'error') {
        healthDb = hb.db;
      }
    } catch {
      healthDb = 'error';
    }

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      // Mobile IMAP path inserts multiple providers; show unified feed by default (no provider filter).
      const res = await fetch('/api/orders?limit=50', {
        credentials: 'include',
        cache: 'no-store',
        headers,
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        orders?: UnifiedOrderRow[];
        error?: string;
        count?: number;
      };

      if (res.status === 401) {
        apiMessage = body.error || 'Sign in to load your saved orders. Extension data may still appear below.';
      } else if (body.ok === false || !res.ok) {
        apiMessage =
          body.error || (res.status === 503 ? 'We’re updating your account. Try again in a moment.' : res.statusText);
      } else {
        dbRows = (body.orders ?? []).map((r) => ({
          ...r,
          backendStatus: r.backendStatus ?? 'ok',
          source: 'database' as const,
        }));
      }
    } catch (e) {
      apiMessage = e instanceof Error ? e.message : 'Failed to load orders';
    }

    let extRows: UnifiedOrderRow[] = [];
    try {
      extRows = await requestExtensionStorage({
        suppressExtensionHints:
          healthDb === 'missing_table' ||
          isOrdersTableMissingMessage(apiMessage ?? undefined),
      });
    } catch {
      /* ignore — chrome.storage only via extension bridge */
    }

    const merged = mergeRows(dbRows, extRows);
    setRows(merged);

    if (merged.length > 0 && apiMessage) {
      if (isOrdersTableMissingMessage(apiMessage)) {
        setWarning(null);
        setError(null);
      } else {
        setWarning(apiMessage);
        setError(null);
      }
    } else if (apiMessage) {
      if (isOrdersTableMissingMessage(apiMessage)) {
        setWarning(null);
        setError(null);
      } else {
        setError(apiMessage);
      }
    }

    setLoading(false);
  }, [requestExtensionStorage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const tick = () => {
      // Avoid work while the tab is hidden (mobile app switch, background).
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void load();
    };
    const id = window.setInterval(tick, 20_000);
    return () => window.clearInterval(id);
  }, [autoRefresh, load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'success') return rows.filter((r) => r.backendStatus === 'ok');
    return rows.filter((r) => r.backendStatus === 'failed' || r.backendStatus === 'pending');
  }, [rows, filter]);

  useEffect(() => {
    if (loading || filtered.length === 0 || aiLocked) return;
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const orders = filtered.map((r) => {
          const platform = inferPlatformFromProvider(r.provider);
          const issue_type = inferIssueTypeFromRow({
            productName: r.productName,
            status: r.status,
            provider: r.provider,
          });
          return {
            id: r.id,
            order_id: r.orderId,
            platform,
            issue_type,
            amount: parsePriceToAmount(r.price),
            order_date: r.date,
          };
        });

        const res = await fetch('/api/refund-decision', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ orders }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          decisions?: Array<
            RefundDecisionOutput & { id: string; order_id: string }
          >;
          ai_truncated?: boolean;
          ai_limit?: number;
          trial_scan_completed?: boolean;
          free_trial_date_filtered?: boolean;
          locked?: boolean;
          upgrade_required?: boolean;
        };

        if (res.status === 403 && body.locked) {
          if (!cancelled) {
            setTrialLockedClient(true);
            setAiPlanHint(
              body.error ?? 'Upgrade to Refyndra Pro for full smart scanning and savings tools.'
            );
          }
          router.refresh();
          return;
        }

        if (!res.ok || body.ok !== true || !Array.isArray(body.decisions)) {
          if (!cancelled) setAiById({});
          return;
        }

        if (!cancelled) {
          const parts: string[] = [];
          if (body.ai_truncated) {
            parts.push(
              'Smart insights apply to your most recent orders this session. Pro includes a larger batch each time.'
            );
          }
          if (!isPro && body.free_trial_date_filtered) {
            parts.push('Your free scan focuses on recent orders so you can see value quickly.');
          }
          setAiPlanHint(parts.length > 0 ? parts.join(' ') : null);
        }

        const next: Record<string, AiDecisionRow> = {};
        for (const d of body.decisions) {
          const raw = d as RefundDecisionOutput & { id: string; manual_required?: unknown };
          next[d.id] = {
            refund_score: d.refund_score,
            priority: d.priority,
            estimated_refund: d.estimated_refund,
            reason: d.reason,
            claim_message: d.claim_message,
            confidence:
              typeof d.confidence === 'number' ? d.confidence : d.refund_score,
            ...(typeof raw.manual_required === 'boolean'
              ? { manual_required: raw.manual_required }
              : {}),
          };
        }
        if (!cancelled) setAiById(next);

        if (!cancelled && body.trial_scan_completed) {
          router.refresh();
        }
      } catch (e) {
        console.error('[AmazonOrdersDashboard] AI refund decision', e);
        if (!cancelled) setAiById({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filtered, loading, maxAiOrdersPerBatch, aiLocked, isPro, router]);

  const scoredGrouped = useMemo(() => {
    const platformOrder: RefundPlatform[] = ['amazon', 'uber_eats', 'uber_rides', 'doordash'];
    const scored = filtered
      .map((row) => {
        const platform = inferPlatformFromProvider(row.provider);
        const issue = inferIssueTypeFromRow({
          productName: row.productName,
          status: row.status,
          provider: row.provider,
        });
        const pr = getRefundPriority({ platform, issue_type: issue });
        const intel = analyzeRefundIntel({
          platform,
          issue_type: issue,
          productName: row.productName,
          status: row.status,
        });
        return { row, ...pr, intel };
      })
      .sort((a, b) => {
        const tr = b.intel.tierRank - a.intel.tierRank;
        if (tr !== 0) return tr;
        return b.priority_score - a.priority_score;
      });

    const groups = new Map<RefundPlatform, typeof scored>();
    for (const p of platformOrder) groups.set(p, []);
    for (const s of scored) {
      const list = groups.get(s.platform);
      if (list) list.push(s);
    }
    return { scored, groups, platformOrder };
  }, [filtered]);

  useEffect(() => {
    if (filtered.length === 0 || aiLocked) return;
    let changed = false;
    void (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      for (const r of filtered) {
        const platform = inferPlatformFromProvider(r.provider);
        const issue = inferIssueTypeFromRow({
          productName: r.productName,
          status: r.status,
          provider: r.provider,
        });
        const ai = aiById[r.id];
        if (!ai) continue;

        if (isAutoRefundActiveForRow(autoPrefs, platform, issue)) {
          const key = `local:${r.id}:${issue}`;
          if (!autoAssistLoggedRef.current.has(key)) {
            autoAssistLoggedRef.current.add(key);
            appendAutoRefundActivity({
              orderId: r.orderId,
              platform,
              issue_type: issue,
              message: 'Savings insight ready — review anytime.',
            });
            changed = true;
          }
        }

        if (
          serverAutonomousMode &&
          isPro &&
          isAutoRefundActiveForRow(autoPrefs, platform, issue) &&
          token
        ) {
          const skey = `srv:${r.id}:${issue}`;
          if (serverAutomationLoggedRef.current.has(skey)) continue;
          const res = await fetch('/api/automation/event', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              order_id: r.orderId,
              platform,
              issue_type: issue,
              action: 'advisory_pipeline',
              detail: { refund_score: ai.refund_score, estimated_refund: ai.estimated_refund },
            }),
          });
          if (res.ok) {
            serverAutomationLoggedRef.current.add(skey);
            changed = true;
          }
        }
      }
      if (changed) setActivityLog(loadAutoRefundActivity());
    })();
  }, [filtered, aiById, autoPrefs, serverAutonomousMode, isPro, aiLocked]);

  const freeTrialPotentialUsd = useMemo(
    () => Object.values(aiById).reduce((s, a) => s + (a.estimated_refund ?? 0), 0),
    [aiById]
  );

  const empty = !loading && filtered.length === 0;

  return (
    <section className="min-w-0 overflow-x-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 shadow-xl shadow-black/20 backdrop-blur-sm">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Your orders</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Pulled from your account and the Refyndra extension. We highlight possible savings — you decide what to do
            next.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Estimates are informational. Nothing is sent to stores until you take action.
          </p>
          {extensionHint && (
            <p className="mt-2 text-xs text-amber-400/90">{extensionHint}</p>
          )}
          {aiPlanHint && (
            <p className="mt-2 rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-xs text-violet-100/95">
              {aiPlanHint}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <div className="flex w-full max-w-md flex-wrap gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)]/50 px-3 py-2">
            <span className="w-full text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Boost savings signals (optional)
            </span>
            {(['amazon', 'uber_eats', 'uber_rides', 'doordash'] as const).map((p) => (
              <label
                key={p}
                className="flex cursor-pointer items-center gap-2 text-[10px] text-zinc-400"
              >
                <input
                  type="checkbox"
                  className="shrink-0 rounded border-[var(--border)] bg-[var(--background)]"
                  checked={autoPrefs[p].enabled}
                  onChange={(e) => updatePlatformAuto(p, e.target.checked)}
                />
                <PlatformOrderIcon platform={p} size="compact" />
                {p === 'amazon'
                  ? 'Amazon'
                  : p === 'uber_eats'
                    ? 'Uber Eats'
                    : p === 'uber_rides'
                      ? 'Uber Rides'
                      : 'DoorDash'}
              </label>
            ))}
          </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-xs text-[var(--muted)] touch-manipulation">
            <input
              type="checkbox"
              className="rounded border-[var(--border)] bg-[var(--background)]"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="min-h-[44px] touch-manipulation rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm font-medium text-white transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Refresh
          </button>
        </div>
        </div>
      </div>

      {aiLocked && !isPro && (
        <div className="border-b border-amber-500/25 bg-amber-500/10 px-4 py-4 sm:px-6">
          <p className="text-sm font-semibold text-amber-100">
            Unlock full Refyndra Pro savings tools
          </p>
          {freeTrialPotentialUsd > 0 && (
            <p className="mt-2 text-xs text-amber-50/95">
              From your free scan, advisory AI estimated about{' '}
              <span className="font-semibold tabular-nums">${freeTrialPotentialUsd.toFixed(2)}</span> total
              potential — not guaranteed.
            </p>
          )}
          <p className="mt-1 text-xs text-amber-200/90">
            Deeper history and unlimited smart batches are included with Pro. You choose when to subscribe — no surprise
            charges.
          </p>
          <Link
            href="/dashboard#plan"
            className="mt-3 inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold text-[#052e16] hover:opacity-95"
          >
            View plans & upgrade
          </Link>
        </div>
      )}

      {!aiLocked && !isPro && freeTrialPotentialUsd > 0 && (
        <div className="border-b border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3 sm:px-6">
          <p className="text-xs font-medium text-emerald-100/95">
            Possible savings from this free scan (estimate):{' '}
            <span className="tabular-nums font-semibold">${freeTrialPotentialUsd.toFixed(2)}</span>
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-6">
        {(['all', 'success', 'failed'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`touch-manipulation rounded-full px-4 py-2 text-xs font-medium capitalize transition min-h-[40px] ${
              filter === f
                ? 'bg-[var(--accent)] text-[#052e16]'
                : 'bg-[var(--background)] text-[var(--muted)] ring-1 ring-[var(--border)] hover:text-white'
            }`}
          >
            {f === 'all' ? 'All' : f === 'success' ? 'Success' : 'Failed'}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-6">
        <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--background)]/30">
          <button
            type="button"
            onClick={() => setShowActivity((s) => !s)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-medium text-zinc-300 hover:bg-white/[0.02]"
          >
            <span>Activity</span>
            <span className="text-zinc-500">{showActivity ? '▼' : '▶'}</span>
          </button>
          {showActivity && (
            <ul className="max-h-44 space-y-1.5 overflow-y-auto border-t border-[var(--border)] px-4 py-3 text-[10px] leading-snug text-zinc-500">
              {activityLog.length === 0 ? (
                <li>
                  No activity yet. Turn on savings signals above to see updates here.
                </li>
              ) : (
                activityLog.map((e, i) => (
                  <li key={`${e.at}-${i}`}>
                    <span className="text-zinc-600">{new Date(e.at).toLocaleString()}</span>
                    {' · '}
                    <span className="text-zinc-400">{e.platform}</span> ·{' '}
                    {e.issue_type.replace(/_/g, ' ')} · {e.orderId}
                    <span className="block text-zinc-500">{e.message}</span>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        {warning && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {warning}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-[var(--muted)]">Loading orders…</div>
        ) : empty ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)]/50 py-16 text-center">
            <p className="text-base font-medium text-[var(--muted)]">
              No compensation signals detected yet
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]/80">
              Sync orders with the extension (Amazon live; Uber paths as your account connects).
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              <span className="font-semibold tabular-nums text-zinc-200">{filtered.length}</span> order
              {filtered.length === 1 ? '' : 's'} · savings signals refresh when you reload or change filters.
            </p>
            {scoredGrouped.platformOrder.map((platform) => {
              const list = scoredGrouped.groups.get(platform) ?? [];
              if (list.length === 0) return null;
              const label =
                platform === 'amazon'
                  ? 'Amazon'
                  : platform === 'uber_eats'
                    ? 'Uber Eats'
                    : platform === 'uber_rides'
                      ? 'Uber Rides'
                      : 'DoorDash';
              const withAi = list.filter(({ row: r }) => aiById[r.id]).length;
              return (
                <div
                  key={platform}
                  className="rounded-xl border border-[var(--border)] bg-[var(--background)]/45 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <PlatformOrderIcon platform={platform} />
                      <h3 className="text-sm font-semibold text-zinc-200">{label}</h3>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {list.length} order{list.length === 1 ? '' : 's'} · {withAi} with savings insight
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                    Filters apply to this list. Activity above shows optional boosts you turned on.
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
