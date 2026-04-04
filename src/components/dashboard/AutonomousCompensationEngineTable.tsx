'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchUsPlatformStats, formatCents, US_PLATFORMS, type PlatformId } from '@/lib/dashboardPlatformStats';
import { getRefundPriority, type PriorityBadgeLabel } from '@/lib/refundPriorityEngine';
import {
  ACE_TABLE_ROWS,
  priorityMatrixPlatform,
  type AceOptionalColumn,
  type AceTableRow,
  type UsMerchantPlatformId,
} from '@/lib/usCompensationEngineTable';

type DraftSlot = 'opt2' | 'opt3';

type PlatformDrafts = { opt2: string; opt3: string };

const SLOT_KEY: Record<DraftSlot, keyof PlatformDrafts> = { opt2: 'opt2', opt3: 'opt3' };

function emptyDrafts(): Record<UsMerchantPlatformId, PlatformDrafts> {
  return {
    amazon: { opt2: '', opt3: '' },
    uber_eats: { opt2: '', opt3: '' },
    uber_rides: { opt2: '', opt3: '' },
    doordash: { opt2: '', opt3: '' },
  };
}

function providerForAcePlatform(p: UsMerchantPlatformId): string {
  switch (p) {
    case 'amazon':
      return 'amazon';
    case 'uber_eats':
      return 'uber_eats';
    case 'uber_rides':
      return 'uber';
    case 'doordash':
      return 'doordash';
    default:
      return 'other';
  }
}

async function pushSessionToExtension(): Promise<void> {
  if (typeof window === 'undefined') return;
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return;
  window.postMessage(
    {
      type: 'REFUNDGUARDIAN_CONNECT_TOKEN',
      token: session.access_token,
      apiBase: window.location.origin,
    },
    window.location.origin
  );
}

function badgeClass(label: PriorityBadgeLabel): string {
  if (label === 'HIGH VALUE') return 'bg-amber-500/15 text-amber-200 ring-amber-500/35';
  if (label === 'FAST') return 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/35';
  if (label === 'MEDIUM') return 'bg-violet-500/12 text-violet-200 ring-violet-500/30';
  return 'bg-zinc-500/12 text-zinc-300 ring-zinc-500/25';
}

function PriorityBadge({ label }: { label: PriorityBadgeLabel }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ring-1 ${badgeClass(label)}`}
    >
      {label}
    </span>
  );
}

function Spinner({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <span
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-zinc-500 border-t-emerald-400 ${className}`}
      aria-hidden
    />
  );
}

function AutoIssueCell({ row }: { row: AceTableRow }) {
  const pp = priorityMatrixPlatform(row.id);
  const { label } = getRefundPriority({ platform: pp, issue_type: row.auto.issueType });
  return (
    <div
      className="rounded-md border border-emerald-500/30 bg-emerald-500/[0.07] px-2 py-2"
      title="Handled automatically in the background — no button required."
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm leading-none" aria-hidden>
          ✅
        </span>
        <span className="text-[11px] font-semibold text-emerald-100">
          {row.auto.title} <span aria-label="priority">⭐</span>
        </span>
        <PriorityBadge label={label} />
      </div>
      <p className="mt-1.5 text-[9px] leading-snug text-zinc-500">
        Auto-handled — use Actions to log Issue #1 (pre-OpenAI).
      </p>
    </div>
  );
}

type ModalState = {
  platformId: UsMerchantPlatformId;
  slot: DraftSlot;
  columnLabel: string;
  issueType: import('@/lib/refundPriorityEngine').RefundIssueType;
  initial: string;
};

type AutonomousCompensationEngineTableProps = {
  /** Extra classes for the root `<section>` (e.g. `mt-0` on the marketing page). */
  className?: string;
};

export function AutonomousCompensationEngineTable({ className }: AutonomousCompensationEngineTableProps = {}) {
  const [drafts, setDrafts] = useState<Record<UsMerchantPlatformId, PlatformDrafts>>(emptyDrafts);
  const [userId, setUserId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [modalText, setModalText] = useState('');
  const [modalError, setModalError] = useState('');
  const [actionPulse, setActionPulse] = useState<string | null>(null);
  const [enhanced, setEnhanced] = useState<Partial<Record<UsMerchantPlatformId, boolean>>>({});
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchUsPlatformStats>>>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      try {
        const raw = localStorage.getItem(`rgAceDrafts_v2_${user.id}`);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<UsMerchantPlatformId, PlatformDrafts>;
          setDrafts((d) => ({ ...d, ...parsed }));
        }
      } catch {
        /* ignore */
      }
    });
  }, []);

  const persistDrafts = useCallback(
    (next: Record<UsMerchantPlatformId, PlatformDrafts>) => {
      setDrafts(next);
      if (userId) {
        try {
          localStorage.setItem(`rgAceDrafts_v2_${userId}`, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
    },
    [userId]
  );

  const refreshStats = useCallback(async () => {
    if (typeof document !== 'undefined' && document.querySelector('[data-ace-modal-open="true"]')) {
      return;
    }
    setStatsLoading(true);
    try {
      const s = await fetchUsPlatformStats();
      setStats(s);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStats();
    const id = window.setInterval(() => void refreshStats(), 8_000);
    return () => window.clearInterval(id);
  }, [refreshStats]);

  const openDraft = useCallback(
    (row: AceTableRow, slot: DraftSlot, column: AceOptionalColumn) => {
      const saved = drafts[row.id][SLOT_KEY[slot]];
      const initial = saved.trim() ? saved : '';
      setModal({
        platformId: row.id,
        slot,
        columnLabel: column.label,
        issueType: column.issueType,
        initial,
      });
      setModalText(initial);
      setModalError('');
    },
    [drafts]
  );

  const clearSlot = useCallback(
    (platformId: UsMerchantPlatformId, slot: DraftSlot) => {
      const k = SLOT_KEY[slot];
      persistDrafts({
        ...drafts,
        [platformId]: { ...drafts[platformId], [k]: '' },
      });
    },
    [drafts, persistDrafts]
  );

  const closeModal = useCallback(() => {
    setModal(null);
    setModalText('');
    setModalError('');
  }, []);

  const confirmModal = useCallback(async () => {
    if (!modal) return;
    const t = modalText.trim();
    if (t.length < 1) {
      setModalError('Enter a message to confirm.');
      return;
    }
    if (t.length > 8000) {
      setModalError('Maximum 8000 characters.');
      return;
    }

    const k = SLOT_KEY[modal.slot];
    const next = {
      ...drafts,
      [modal.platformId]: {
        ...drafts[modal.platformId],
        [k]: t,
      },
    };
    persistDrafts(next);
    await pushSessionToExtension();

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('compensation_events').insert({
        user_id: user.id,
        source: 'ace_table',
        platform_key: modal.platformId,
        provider: providerForAcePlatform(modal.platformId),
        auto_issue_type: modal.issueType,
        optional_issue_types: [],
        message_preview: t.slice(0, 2000),
        metadata: {
          slot: modal.slot,
          label: modal.columnLabel,
          enhanced_compensation: true,
        },
      });
      if (error) {
        console.warn('[RefundGuardian] compensation_events insert', error.message);
      }
    }

    console.log('[RefundGuardian] ace_enhanced_compensation_draft', {
      platform: modal.platformId,
      issue: modal.issueType,
      slot: modal.slot,
    });
    closeModal();
  }, [modal, modalText, drafts, persistDrafts, closeModal]);

  const onApprove = useCallback(
    async (row: AceTableRow) => {
      setActionPulse(`${row.id}-approve`);
      window.setTimeout(() => setActionPulse(null), 900);
      await pushSessionToExtension();

      const d = drafts[row.id];
      const opt: string[] = [];
      if (d.opt2.trim()) opt.push(row.optional2.issueType);
      if (d.opt3.trim()) opt.push(row.optional3.issueType);

      const autoType = row.auto.issueType;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('compensation_events').insert({
          user_id: user.id,
          source: 'ace_table',
          platform_key: row.id,
          provider: providerForAcePlatform(row.id),
          auto_issue_type: autoType,
          optional_issue_types: opt,
          message_preview: `Confirm — Issue #1 (${row.auto.title}) · ${row.platformLabel}`,
          metadata: { action: 'approve_auto_compensation', pre_openai: true },
        });
        if (error) console.warn('[RefundGuardian] approve insert', error.message);
      }

      console.log('[RefundGuardian] approve_auto_compensation', { platform: row.id, auto: autoType, optional: opt });
    },
    [drafts]
  );

  const onEnhance = useCallback(
    async (row: AceTableRow, hasOptional: boolean) => {
      if (!hasOptional) return;
      setActionPulse(`${row.id}-enhance`);
      setEnhanced((e) => ({ ...e, [row.id]: true }));
      window.setTimeout(() => setActionPulse(null), 900);
      await pushSessionToExtension();
      console.log('[RefundGuardian] enhance_compensation_optional', {
        platform: row.id,
        opt2_len: drafts[row.id].opt2.length,
        opt3_len: drafts[row.id].opt3.length,
      });
    },
    [drafts]
  );

  const mapStatId = (id: PlatformId): UsMerchantPlatformId | null => {
    if (id === 'amazon') return 'amazon';
    if (id === 'uber_eats') return 'uber_eats';
    if (id === 'uber') return 'uber_rides';
    if (id === 'doordash') return 'doordash';
    return null;
  };

  const optionalColumn = useCallback(
    (row: AceTableRow, slot: DraftSlot, col: AceOptionalColumn) => {
      const pp = priorityMatrixPlatform(row.id);
      const { label: badge } = getRefundPriority({ platform: pp, issue_type: col.issueType });
      const value = drafts[row.id][SLOT_KEY[slot]];
      const has = value.trim().length > 0;

      return (
        <div className="rounded-md border border-zinc-700/60 bg-zinc-950/40 p-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold text-zinc-100">{col.label}</span>
            <PriorityBadge label={badge} />
          </div>
          <p className="mt-0.5 text-[9px] text-zinc-500">Manual selection required</p>
          <label className="mt-1.5 flex cursor-pointer items-start gap-1.5">
            <input
              type="checkbox"
              className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/40"
              checked={has}
              title={has ? 'Uncheck to clear this draft' : 'Check to open draft with placeholder message'}
              onChange={(e) => {
                if (e.target.checked) openDraft(row, slot, col);
                else clearSlot(row.id, slot);
              }}
            />
            <span className="text-[9px] text-zinc-500">Include optional issue (opens draft)</span>
          </label>
          {!has ? (
            <p className="mt-1.5 text-[9px] leading-relaxed text-zinc-600">
              Check the box to open a draft. Optional message text is filled when you confirm or when AI is
              configured.
            </p>
          ) : (
            <div className="mt-1.5 space-y-0.5">
              <p className="line-clamp-2 text-[10px] text-zinc-400">{value}</p>
              <button
                type="button"
                onClick={() => openDraft(row, slot, col)}
                className="cursor-pointer text-[10px] font-medium text-[var(--accent)] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
              >
                Edit draft
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => openDraft(row, slot, col)}
            className="mt-1.5 min-h-[44px] w-full touch-manipulation cursor-pointer rounded-md bg-zinc-800 px-2 py-2 text-[10px] font-semibold text-zinc-100 transition hover:bg-zinc-700 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            title="Open message draft — Confirm sends enhanced compensation log (pre-OpenAI)"
          >
            Draft message
          </button>
        </div>
      );
    },
    [drafts, openDraft, clearSlot]
  );

  return (
    <section
      className={`min-w-0 overflow-x-hidden ${className ?? 'mt-8 sm:mt-10'}`}
      aria-labelledby="ace-heading"
      data-testid="autonomous-compensation-engine-table"
    >
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Autonomous Compensation Engine
          </p>
          <h2 id="ace-heading" className="mt-1 text-base font-semibold tracking-tight text-white sm:text-lg">
            AI Priority Engine
          </h2>
          <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-[var(--muted)]">
            <span className="font-semibold text-zinc-300">Automatic:</span> One row per merchant (Amazon, Uber Eats, Uber
            Rides, DoorDash). Issue #1 is delay-related — late delivery or trip delay is processed in the background; you
            do not need to type anything for delays. Tap <span className="text-zinc-400">Approve auto compensation</span>{' '}
            only when you want that automatic lane logged on your account (pre-OpenAI).{' '}
            <span className="font-semibold text-zinc-300">Optional:</span> Issues #2–3 are extra — use them only if you
            need to describe something else (missing items, charges, food quality, etc.). Check the box, use{' '}
            <span className="text-zinc-400">Draft message</span>, then <span className="text-zinc-400">Confirm</span>.{' '}
            <span className="font-semibold text-zinc-300">Enhance</span> is available after you have optional drafts.
          </p>
          <p className="mt-1 text-[9px] text-zinc-600">
            Desktop table · Amazon → Uber Eats → Uber Rides → DoorDash
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          {statsLoading ? <Spinner className="h-3 w-3" /> : null}
          <span>
            {stats?.fetchedAt
              ? `Signals · ${new Date(stats.fetchedAt).toLocaleTimeString()}`
              : statsLoading
                ? 'Loading stats…'
                : '—'}
          </span>
        </div>
      </div>

      <div className="mb-2 rounded-lg border border-[var(--border)] bg-zinc-900/35 px-2 py-2">
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
          Per-platform signals (auto-refresh ~8s)
        </p>
        {statsLoading && !stats ? (
          <div className="flex items-center gap-2 py-1 text-[11px] text-zinc-400">
            <Spinner className="h-3 w-3" />
            <span>Loading order and refund totals…</span>
          </div>
        ) : stats ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-zinc-300">
            {US_PLATFORMS.map((p) => {
              const mid = mapStatId(p.id);
              if (!mid) return null;
              const o = stats.orderCounts[p.id];
              const c = stats.compensationCents[p.id];
              return (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950/50 px-2 py-1 ring-1 ring-white/5"
                >
                  <span className="text-zinc-500">{p.label}</span>
                  <span className="text-zinc-400">·</span>
                  {statsLoading ? (
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Spinner className="h-3 w-3" />
                      <span className="opacity-80">
                        {o} orders · {formatCents(c)}
                      </span>
                    </span>
                  ) : (
                    <span className="tabular-nums">
                      {o} orders · {formatCents(c)}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">Stats unavailable (signed in users only).</p>
        )}
      </div>

      <div className="-mx-1 overflow-x-auto overscroll-x-contain rounded-xl border border-[var(--border)] bg-[var(--card)]/85 shadow-lg ring-1 ring-white/[0.06] [-webkit-overflow-scrolling:touch] sm:mx-0">
        <table className="w-full min-w-[860px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] bg-zinc-900/55">
              <th className="px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Platform</th>
              <th className="min-w-[160px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
                Issue #1 (Auto)
              </th>
              <th className="min-w-[168px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
                Issue #2 (Optional)
              </th>
              <th className="min-w-[168px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
                Issue #3 (Optional)
              </th>
              <th className="w-[168px] min-w-[168px] px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {ACE_TABLE_ROWS.map((row) => {
              const hasOpt = drafts[row.id].opt2.trim() || drafts[row.id].opt3.trim();
              return (
                <tr
                  key={row.id}
                  className="border-b border-[var(--border)]/80 align-top hover:bg-white/[0.02]"
                  data-platform={row.id}
                >
                  <td className="px-2.5 py-2.5">
                    <div className="flex items-start gap-1.5">
                      <span className="text-lg leading-none select-none" aria-hidden>
                        {row.emoji}
                      </span>
                      <div>
                        <p className="text-[12px] font-semibold leading-tight text-zinc-100">{row.platformLabel}</p>
                        <p className="text-[10px] text-zinc-500">{row.domain}</p>
                        <p className="mt-0.5 text-[9px] text-zinc-600">{row.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2.5 py-2.5">
                    <AutoIssueCell row={row} />
                  </td>
                  <td className="px-2.5 py-2.5">{optionalColumn(row, 'opt2', row.optional2)}</td>
                  <td className="px-2.5 py-2.5">{optionalColumn(row, 'opt3', row.optional3)}</td>
                  <td className="px-2.5 py-2.5">
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => void onApprove(row)}
                        className={`min-h-[44px] w-full cursor-pointer touch-manipulation rounded-md border border-emerald-500/45 bg-emerald-500/12 px-2.5 py-2 text-left text-[10px] font-semibold leading-snug text-emerald-50 transition hover:bg-emerald-500/20 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 sm:w-auto ${
                          actionPulse === `${row.id}-approve` ? 'ring-2 ring-emerald-400/45' : ''
                        }`}
                        title="Logs Issue #1 (automatic lane) for this platform — pre-OpenAI compensation confirmation."
                      >
                        Approve auto compensation
                      </button>
                      <button
                        type="button"
                        disabled={!hasOpt}
                        onClick={() => void onEnhance(row, hasOpt)}
                        className={`min-h-[44px] w-full cursor-pointer touch-manipulation rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-left text-[10px] font-medium leading-snug text-zinc-200 transition hover:bg-zinc-800 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 sm:w-auto ${
                          actionPulse === `${row.id}-enhance` ? 'ring-2 ring-amber-400/35' : ''
                        } ${enhanced[row.id] ? 'ring-1 ring-amber-500/40' : ''}`}
                        title={
                          hasOpt
                            ? 'Applies optional enhancement when drafts exist for issues #2–3.'
                            : 'Confirm at least one optional issue draft first.'
                        }
                      >
                        Enhance compensation (optional)
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] leading-snug text-zinc-500 md:hidden">
        Swipe horizontally to view all merchant columns and actions.
      </p>

      {modal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          data-ace-modal-open="true"
          aria-labelledby="ace-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl">
            <h3 id="ace-modal-title" className="text-sm font-semibold text-white">
              {modal.columnLabel}
            </h3>
            <p className="mt-1 text-[11px] text-zinc-500">
              {modal.platformId.replace(/_/g, ' ')} · Enhanced compensation (pre-OpenAI)
            </p>
            <textarea
              value={modalText}
              onChange={(e) => {
                setModalText(e.target.value);
                setModalError('');
              }}
              rows={9}
              className="mt-3 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-zinc-200 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
            />
            {modalError ? <p className="mt-2 text-xs text-amber-300">{modalError}</p> : null}
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="min-h-[44px] w-full touch-manipulation cursor-pointer rounded-lg border border-[var(--border)] px-4 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmModal()}
                className="min-h-[44px] w-full touch-manipulation cursor-pointer rounded-lg bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold text-[var(--background)] transition hover:opacity-90 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 sm:w-auto"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
