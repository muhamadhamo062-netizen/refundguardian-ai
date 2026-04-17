'use client';

// Mobile update v2 - 2026-04-11T18:30:00Z — audit: text-base + sm:text-sm for body UI
import Link from 'next/link';
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
import { UPGRADE_PRICE_STEAL_DISPLAY } from '@/lib/refyndraCoreBusiness';
import { DASHBOARD_ORDERS_REFRESH_EVENT } from '@/lib/dashboard/ordersRefresh';
import { PlatformOrderIcon } from '@/components/dashboard/PlatformOrderIcon';

export type UnifiedOrderRow = {
  id: string;
  orderId: string;
  productName: string;
  price: string;
  date: string;
  backendStatus: 'ok' | 'failed' | 'pending';
  extractedAt: string;
  source: 'database';
  /** Present when row comes from GET /api/orders (database) */
  provider?: string;
  /** Optional status line from synced order data (used for AI issue inference) */
  status?: string;
};

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

/** Always show a clear USD-style amount in the orders table. */
function formatOrderPriceDisplay(price: string | undefined): string {
  const p = (price ?? '—').trim();
  if (!p || p === '—') return '—';
  if (p.startsWith('$')) return p;
  return `$${p}`;
}

/** Augments AI output; `manual_required` is optional on API payloads (UI only). */
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
  const [rows, setRows] = useState<UnifiedOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');
  // Default off: avoids aggressive polling that can make the dashboard feel laggy on navigation.
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [aiById, setAiById] = useState<Record<string, AiDecisionRow>>({});
  const [autoPrefs, setAutoPrefs] = useState<AutoRefundPrefs>(defaultAutoRefundPrefs);
  const [activityLog, setActivityLog] = useState<AutoRefundActivityEntry[]>([]);
  const [showActivity, setShowActivity] = useState(false);
  const [aiPlanHint, setAiPlanHint] = useState<string | null>(null);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [clientTrialLocked, setClientTrialLocked] = useState(false);
  const autoAssistLoggedRef = useRef<Set<string>>(new Set());
  const serverAutomationLoggedRef = useRef<Set<string>>(new Set());

  const aiLocked = trialScanLocked || clientTrialLocked;

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

  const load = useCallback(async () => {
    setError(null);
    setWarning(null);
    setLoading(true);
    let dbRows: UnifiedOrderRow[] = [];
    let apiMessage: string | null = null;

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
        apiMessage = body.error || 'Sign in to load your saved orders.';
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

    try {
      setRows(dbRows);

      if (dbRows.length > 0 && apiMessage) {
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => {
      void load();
    };
    window.addEventListener(DASHBOARD_ORDERS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(DASHBOARD_ORDERS_REFRESH_EVENT, onRefresh);
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
    if (loading || filtered.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;

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

        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const res = await fetch('/api/refund-decision', {
          method: 'POST',
          credentials: 'include',
          headers,
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
        };

        if (!res.ok || body.ok !== true || !Array.isArray(body.decisions)) {
          if (!cancelled) setAiById({});
          return;
        }

        if (!cancelled) {
          setAiPlanHint(
            body.ai_truncated
              ? 'Advisory AI is applied to your highest-priority batch for this session (row limit).'
              : null
          );
        }

        if (!cancelled && body.trial_scan_completed) {
          setClientTrialLocked(true);
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
            ...(typeof d.ai_complaint === 'string' && d.ai_complaint.trim()
              ? { ai_complaint: d.ai_complaint }
              : {}),
            ...(d.complaint_status ? { complaint_status: d.complaint_status } : {}),
            ...(typeof d.pro_locked === 'boolean' ? { pro_locked: d.pro_locked } : {}),
            ...(typeof raw.manual_required === 'boolean'
              ? { manual_required: raw.manual_required }
              : {}),
          };
        }
        if (!cancelled) setAiById(next);
      } catch {
        if (!cancelled) setAiById({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filtered, loading, maxAiOrdersPerBatch]);

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

  const platformTableLabel = (platform: RefundPlatform) =>
    platform === 'amazon'
      ? 'Amazon'
      : platform === 'uber_eats'
        ? 'Uber Eats'
        : platform === 'uber_rides'
          ? 'Uber Rides'
          : 'DoorDash';

  const copyAiComplaint = useCallback(
    async (rowId: string) => {
      const ai = aiById[rowId];
      const text = (ai?.ai_complaint ?? ai?.claim_message ?? '').trim();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        setCopiedRowId(rowId);
        window.setTimeout(() => {
          setCopiedRowId((cur) => (cur === rowId ? null : cur));
        }, 2000);
      } catch {
        /* ignore */
      }
    },
    [aiById]
  );

  const empty = !loading && filtered.length === 0;

  return (
    <section className="w-full min-w-0 overflow-x-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 shadow-xl shadow-black/20 backdrop-blur-sm">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="text-[1.75rem] font-bold !leading-tight tracking-tight text-white sm:text-2xl sm:font-semibold">
            Your orders
          </h2>
          <p className="mt-1 !text-base !font-medium leading-relaxed text-zinc-100 sm:text-sm sm:!font-normal sm:text-[var(--muted)]">
            Orders synced to your account. Advisory AI ranks possible savings — you choose when to follow up.
          </p>
          <p className="mt-2 text-base text-zinc-200 sm:text-sm sm:text-zinc-500">
            Estimates are informational. Nothing is sent to merchants until you act.
          </p>
          {aiPlanHint && (
            <p className="mt-2 rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-base text-violet-50 sm:text-sm sm:text-violet-100/95">
              {aiPlanHint}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <div className="flex w-full max-w-md flex-wrap gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)]/50 px-3 py-2">
            <span className="w-full text-base font-semibold uppercase tracking-wide text-zinc-300 sm:text-sm sm:text-zinc-500">
              Savings alerts (optional)
            </span>
            {(['amazon', 'uber_eats', 'uber_rides', 'doordash'] as const).map((p) => (
              <label
                key={p}
                className="flex cursor-pointer items-center gap-2 text-base font-medium text-zinc-200 sm:text-sm sm:font-normal sm:text-zinc-400"
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
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-base font-medium text-zinc-200 touch-manipulation sm:min-h-[40px] sm:text-sm sm:font-normal sm:text-[var(--muted)]">
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
            className="min-h-[48px] touch-manipulation rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base font-semibold text-white transition hover:border-[var(--accent)] hover:text-[var(--accent)] sm:min-h-[44px] sm:py-2.5 sm:text-sm sm:font-medium"
          >
            Refresh
          </button>
        </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-6">
        {(['all', 'success', 'failed'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`touch-manipulation min-h-[44px] rounded-full px-4 py-2.5 text-base font-semibold capitalize transition sm:min-h-[40px] sm:py-2 sm:text-sm sm:font-medium ${
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
            className="flex min-h-[48px] w-full items-center justify-between px-4 py-3 text-left text-base font-semibold text-zinc-200 hover:bg-white/[0.02] sm:min-h-0 sm:py-2.5 sm:text-sm sm:font-medium sm:text-zinc-300"
          >
            <span>Activity</span>
            <span className="text-zinc-500">{showActivity ? '▼' : '▶'}</span>
          </button>
          {showActivity && (
            <ul className="max-h-44 space-y-1.5 overflow-y-auto border-t border-[var(--border)] px-4 py-3 text-base font-medium leading-snug text-zinc-300 sm:text-sm sm:font-normal sm:text-zinc-500">
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
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-base text-amber-50 sm:text-sm sm:text-amber-100">
            {warning}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-base text-red-100 sm:text-sm sm:text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-base text-[var(--muted)] sm:text-sm">Loading orders…</div>
        ) : empty ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)]/50 py-16 text-center">
            <p className="text-base font-medium text-[var(--muted)]">
              No compensation signals detected yet
            </p>
            <p className="mt-2 text-base text-zinc-200/95 sm:text-sm sm:text-[var(--muted)]/80">
              Use <span className="font-semibold text-white">Primary action</span> above to link Gmail, then tap{' '}
              <span className="font-semibold text-white">Refresh</span>.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-base text-zinc-200 sm:text-sm sm:text-zinc-400">
              <span className="font-semibold tabular-nums text-white">{filtered.length}</span> order
              {filtered.length === 1 ? '' : 's'} · advisory copy refreshes when you reload or change filters.
            </p>

            <div className="grid grid-cols-1 gap-4 md:hidden">
              {scoredGrouped.scored.map(({ row: r, platform, intel }) => {
                const ai = aiById[r.id];
                const rowLocked = Boolean(ai?.pro_locked);
                const canCopy =
                  !rowLocked && Boolean((ai?.ai_complaint ?? ai?.claim_message ?? '').trim());
                const alertsOn = autoPrefs[platform].enabled;
                return (
                  <article
                    key={r.id}
                    className="rounded-2xl border border-white/15 bg-white/[0.06] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <PlatformOrderIcon platform={platform} size="compact" />
                        <span className="text-lg font-bold text-white">{platformTableLabel(platform)}</span>
                      </div>
                      <span
                        className={
                          r.backendStatus === 'ok'
                            ? 'shrink-0 text-sm font-semibold text-emerald-400'
                            : r.backendStatus === 'failed'
                              ? 'shrink-0 text-sm font-semibold text-red-300'
                              : 'shrink-0 text-sm font-semibold text-amber-300'
                        }
                      >
                        {r.backendStatus === 'ok' ? 'Synced' : r.backendStatus === 'failed' ? 'Failed' : 'Pending'}
                      </span>
                    </div>
                    <div className="mt-3">
                      <p className="font-semibold leading-snug text-white" title={r.productName}>
                        {r.productName}
                      </p>
                      <p className="mt-1 truncate text-sm text-zinc-400" title={r.orderId}>
                        {r.orderId}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-white/10 pt-3">
                      <span className="text-xl font-bold tabular-nums text-emerald-300">
                        {formatOrderPriceDisplay(r.price)}
                      </span>
                      <span className="text-sm text-zinc-300">{r.date}</span>
                    </div>
                    <div className="mt-3 rounded-xl border border-violet-500/20 bg-black/20 px-3 py-2">
                      {ai && rowLocked ? (
                        <>
                          <p className="flex items-center gap-2 text-base font-semibold text-amber-200">
                            <span aria-hidden>🔒</span>
                            <span>Pro-locked insight</span>
                          </p>
                          <p className="mt-1 text-sm leading-snug text-zinc-200">
                            Up to{' '}
                            <span className="font-bold text-white">
                              ${Number(ai.estimated_refund ?? 0).toFixed(2)}
                            </span>{' '}
                            flagged — upgrade to unlock the full AI Lawyer and drafts.
                          </p>
                        </>
                      ) : ai ? (
                        <>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-300/95">
                            {intel.displayLabel}
                          </p>
                          <p className="mt-1 line-clamp-3 text-sm leading-snug text-zinc-100" title={ai.reason}>
                            {ai.reason}
                          </p>
                        </>
                      ) : aiLocked ? (
                        <p className="text-sm text-zinc-500">—</p>
                      ) : (
                        <p className="text-sm text-zinc-400">Preparing advisory…</p>
                      )}
                    </div>
                    <div className="mt-4 flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={() => updatePlatformAuto(platform, !alertsOn)}
                        className="flex w-full min-h-[52px] touch-manipulation flex-col items-stretch justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-left transition hover:bg-emerald-500/25"
                      >
                        <span className="text-lg font-bold text-white">Auto</span>
                        <span className="mt-0.5 text-sm font-medium leading-snug text-emerald-100/95">
                          {alertsOn
                            ? 'Savings alerts on for this platform — tap to turn off'
                            : 'Savings alerts off — tap to turn on for this platform'}
                        </span>
                      </button>
                      {rowLocked && !isPro ? (
                        <Link
                          href="/pricing"
                          className="flex w-full min-h-[52px] touch-manipulation flex-col items-center justify-center rounded-xl border border-violet-400/50 bg-gradient-to-r from-violet-600/90 to-fuchsia-600/90 px-4 py-3 text-center text-base font-bold text-white shadow-[0_0_24px_rgba(139,92,246,0.45)]"
                        >
                          <span>Upgrade to Pro to Claim</span>
                          <span className="mt-0.5 text-xs font-semibold text-violet-100/95">
                            One-time steal · {UPGRADE_PRICE_STEAL_DISPLAY} vs money left on the table
                          </span>
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled={!canCopy}
                          onClick={() => void copyAiComplaint(r.id)}
                          className={`flex w-full min-h-[52px] touch-manipulation flex-col items-stretch justify-center rounded-xl px-4 py-3 text-center transition ${
                            canCopy
                              ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-[0_0_24px_rgba(139,92,246,0.4)] hover:brightness-110'
                              : 'cursor-not-allowed bg-zinc-800 text-zinc-500'
                          }`}
                        >
                          <span className="text-lg font-bold">Manual</span>
                          <span className="mt-0.5 text-sm font-semibold opacity-95">
                            {copiedRowId === r.id
                              ? 'Copied to clipboard'
                              : canCopy
                                ? 'Copy AI complaint'
                                : 'Advisory not ready yet'}
                          </span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--background)]/40 md:block">
              <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <th scope="col" className="px-3 py-3 sm:px-4">
                      Platform
                    </th>
                    <th scope="col" className="px-3 py-3 sm:px-4">
                      Order
                    </th>
                    <th scope="col" className="px-3 py-3 text-right sm:px-4">
                      Price
                    </th>
                    <th scope="col" className="px-3 py-3 sm:px-4">
                      Date
                    </th>
                    <th scope="col" className="px-3 py-3 sm:px-4">
                      Sync
                    </th>
                    <th scope="col" className="px-3 py-3 sm:px-4">
                      Advisory
                    </th>
                    <th scope="col" className="px-3 py-3 sm:px-4">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="text-zinc-200">
                  {scoredGrouped.scored.map(({ row: r, platform, intel }) => {
                    const ai = aiById[r.id];
                    const rowLocked = Boolean(ai?.pro_locked);
                    const canCopy =
                      !rowLocked && Boolean((ai?.ai_complaint ?? ai?.claim_message ?? '').trim());
                    return (
                      <tr key={r.id} className="border-b border-[var(--border)]/80 last:border-0">
                        <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                          <span className="inline-flex items-center gap-2">
                            <PlatformOrderIcon platform={platform} size="compact" />
                            {platformTableLabel(platform)}
                          </span>
                        </td>
                        <td className="max-w-[14rem] px-3 py-3 sm:max-w-[18rem] sm:px-4">
                          <div className="truncate font-medium text-white" title={r.productName}>
                            {r.productName}
                          </div>
                          <div className="truncate text-xs text-zinc-500" title={r.orderId}>
                            {r.orderId}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-emerald-300 sm:px-4">
                          {formatOrderPriceDisplay(r.price)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-zinc-400 sm:px-4">{r.date}</td>
                        <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                          <span
                            className={
                              r.backendStatus === 'ok'
                                ? 'text-emerald-400'
                                : r.backendStatus === 'failed'
                                  ? 'text-red-300'
                                  : 'text-amber-300'
                            }
                          >
                            {r.backendStatus === 'ok' ? 'OK' : r.backendStatus === 'failed' ? 'Failed' : 'Pending'}
                          </span>
                        </td>
                        <td className="max-w-xs px-3 py-3 text-zinc-400 sm:px-4">
                          {ai && rowLocked ? (
                            <div>
                              <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                                <span aria-hidden>🔒</span>
                                <span>Pro-locked</span>
                              </p>
                              <p className="mt-1 text-sm text-zinc-200">
                                Up to{' '}
                                <span className="font-bold text-white">
                                  ${Number(ai.estimated_refund ?? 0).toFixed(2)}
                                </span>{' '}
                                flagged.
                              </p>
                            </div>
                          ) : ai ? (
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-300/90">
                                {intel.displayLabel}
                              </p>
                              <p className="mt-1 line-clamp-2 text-sm" title={ai.reason}>
                                {ai.reason}
                              </p>
                            </div>
                          ) : aiLocked ? (
                            <span className="text-zinc-600">—</span>
                          ) : (
                            <span className="text-zinc-500">Preparing advisory…</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                          {rowLocked && !isPro ? (
                            <Link
                              href="/pricing"
                              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-violet-400/50 bg-violet-600/20 px-3 py-2.5 text-sm font-bold text-violet-100 hover:bg-violet-600/30 sm:min-h-0"
                            >
                              Upgrade to Pro · {UPGRADE_PRICE_STEAL_DISPLAY}
                            </Link>
                          ) : (
                            <button
                              type="button"
                              disabled={!canCopy}
                              onClick={() => void copyAiComplaint(r.id)}
                              className={`min-h-[44px] touch-manipulation rounded-lg px-3 py-2.5 text-sm font-semibold transition sm:min-h-0 ${
                                canCopy
                                  ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white ring-1 ring-violet-300/60 shadow-[0_0_22px_rgba(168,85,247,0.45)] hover:from-violet-400 hover:to-fuchsia-400 hover:shadow-[0_0_28px_rgba(217,70,239,0.52)]'
                                  : 'cursor-not-allowed bg-zinc-800 text-zinc-600'
                              }`}
                            >
                              {copiedRowId === r.id ? 'Copied' : 'Copy AI Complaint'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
