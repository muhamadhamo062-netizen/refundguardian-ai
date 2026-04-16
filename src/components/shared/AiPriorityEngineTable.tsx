'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type PlatformKey = 'amazon' | 'uber_eats' | 'uber_rides' | 'doordash';

type IssueKey =
  | 'late_delivery_auto'
  | 'trip_delay_auto'
  | 'missing_item'
  | 'cold_food'
  | 'charged_incorrectly'
  | 'damaged_item'
  | 'trip_issue'
  | 'driver_route_issue';

type RowSpec = {
  key: PlatformKey;
  label: string;
  auto: { title: string; badge: string; issueKey: IssueKey };
  manual: Array<{ title: string; issueKey: IssueKey }>;
};

const ROWS: RowSpec[] = [
  {
    key: 'amazon',
    label: 'Amazon',
    auto: { title: 'Late delivery', badge: '⭐', issueKey: 'late_delivery_auto' },
    manual: [
      { title: 'Missing item', issueKey: 'missing_item' },
      { title: 'Charged incorrectly', issueKey: 'charged_incorrectly' },
      { title: 'Damaged item', issueKey: 'damaged_item' },
    ],
  },
  {
    key: 'uber_eats',
    label: 'Uber Eats',
    auto: { title: 'Late delivery', badge: '⭐', issueKey: 'late_delivery_auto' },
    manual: [
      { title: 'Missing item', issueKey: 'missing_item' },
      { title: 'Cold food', issueKey: 'cold_food' },
      { title: 'Charged incorrectly', issueKey: 'charged_incorrectly' },
    ],
  },
  {
    key: 'uber_rides',
    label: 'Uber Rides',
    auto: { title: 'Trip delay', badge: '⭐', issueKey: 'trip_delay_auto' },
    manual: [
      { title: 'Charged incorrectly', issueKey: 'charged_incorrectly' },
      { title: 'Trip issue', issueKey: 'trip_issue' },
      { title: 'Driver route issue', issueKey: 'driver_route_issue' },
    ],
  },
  {
    key: 'doordash',
    label: 'DoorDash',
    auto: { title: 'Late delivery', badge: '⭐', issueKey: 'late_delivery_auto' },
    manual: [
      { title: 'Missing item', issueKey: 'missing_item' },
      { title: 'Cold food', issueKey: 'cold_food' },
      { title: 'Charged incorrectly', issueKey: 'charged_incorrectly' },
    ],
  },
];

type SelectionState = Record<PlatformKey, Partial<Record<IssueKey, boolean>>>;

function emptySelection(): SelectionState {
  return {
    amazon: {},
    uber_eats: {},
    uber_rides: {},
    doordash: {},
  };
}

function storageKey(userId: string | null): string {
  return userId ? `rgAiPriority_v1_${userId}` : `rgAiPriority_v1_anon`;
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-emerald-400"
      aria-hidden
    />
  );
}

export function AiPriorityEngineTable({ className = '' }: { className?: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [sel, setSel] = useState<SelectionState>(emptySelection);
  const [loadingUser, setLoadingUser] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftOpen, setDraftOpen] = useState<{ platform: PlatformKey } | null>(null);
  const [draftText, setDraftText] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
      setLoadingUser(false);
    });
  }, []);

  useEffect(() => {
    // Load per-user preferences once we know which key to use.
    try {
      const raw = localStorage.getItem(storageKey(userId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as SelectionState;
      setSel((cur) => ({ ...cur, ...parsed }));
    } catch {
      /* ignore */
    }
  }, [userId]);

  const persist = useCallback(
    (next: SelectionState) => {
      setSel(next);
      try {
        localStorage.setItem(storageKey(userId), JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [userId]
  );

  const toggle = useCallback(
    (platform: PlatformKey, issue: IssueKey, v: boolean) => {
      const next: SelectionState = {
        ...sel,
        [platform]: { ...sel[platform], [issue]: v },
      };
      persist(next);
    },
    [persist, sel]
  );

  const selectedManualCount = useCallback(
    (platform: PlatformKey) => {
      const row = sel[platform] || {};
      // Only count manual flags.
      const manualKeys = new Set<IssueKey>([
        'missing_item',
        'cold_food',
        'charged_incorrectly',
        'damaged_item',
        'trip_issue',
        'driver_route_issue',
      ]);
      let n = 0;
      for (const k of manualKeys) {
        if (row[k]) n += 1;
      }
      return n;
    },
    [sel]
  );

  const onApprove = useCallback(
    async (platform: PlatformKey) => {
      if (!userId) {
        setToast('Please log in to approve compensation.');
        return;
      }
      setSaving(true);
      try {
        const supabase = createClient();
        const manual = sel[platform] || {};
        const selected = Object.entries(manual)
          .filter(([, v]) => v === true)
          .map(([k]) => k);

        // Best-effort: log to compensation_events if table exists; never block UX.
        await supabase.from('compensation_events').insert({
          user_id: userId,
          source: 'ai_priority_table',
          platform_key: platform,
          provider: platform === 'uber_rides' ? 'uber' : platform,
          auto_issue_type: platform === 'uber_rides' ? 'trip_delay' : 'late_delivery',
          optional_issue_types: selected,
          message_preview: '',
          metadata: { selected_manual: selected, ui: 'approve_compensation' },
        });

        setToast('Saved. We’ll use this to help draft your request.');
      } catch (e) {
        setToast(e instanceof Error ? e.message : 'Could not save.');
      } finally {
        setSaving(false);
        window.setTimeout(() => setToast(null), 3500);
      }
    },
    [sel, userId]
  );

  const openDraft = useCallback(
    async (platform: PlatformKey) => {
      const row = ROWS.find((r) => r.key === platform);
      const manual = sel[platform] || {};
      const selectedKeys = row?.manual.filter((m) => manual[m.issueKey]).map((m) => m.issueKey) ?? [];
      if (!selectedKeys.length) {
        setToast('Select at least one manual issue first.');
        window.setTimeout(() => setToast(null), 2500);
        return;
      }

      setDraftOpen({ platform });
      setDraftLoading(true);
      setDraftText('');

      try {
        const res = await fetch('/api/ai/draft-compensation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform, manualIssues: selectedKeys }),
        });
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; draft?: string; error?: string };
        if (!res.ok || body.ok !== true || typeof body.draft !== 'string') {
          const fallback = `Hi,\n\nI’m reaching out about my recent ${row?.label ?? 'order'}.\n\nIssue(s): ${selectedKeys.join(
            ', '
          )}\n\nPlease review and assist with an appropriate adjustment.\n\nThanks,\n[Your Name]`;
          setDraftText(fallback);
          setToast(body.error || 'Could not generate AI draft. Showing template instead.');
          window.setTimeout(() => setToast(null), 3500);
          return;
        }
        setDraftText(body.draft);
      } catch (e) {
        const fallback = `Hi,\n\nI’m reaching out about my recent ${row?.label ?? 'order'}.\n\nIssue(s): ${selectedKeys.join(
          ', '
        )}\n\nPlease review and assist with an appropriate adjustment.\n\nThanks,\n[Your Name]`;
        setDraftText(fallback);
        setToast(e instanceof Error ? e.message : 'Draft request failed. Showing template instead.');
        window.setTimeout(() => setToast(null), 3500);
      } finally {
        setDraftLoading(false);
      }
    },
    [sel]
  );

  const closeDraft = useCallback(() => {
    setDraftOpen(null);
    setDraftText('');
    setDraftLoading(false);
  }, []);

  const copyDraft = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(draftText);
      setToast('Draft copied to clipboard.');
    } catch {
      setToast('Could not copy draft.');
    } finally {
      window.setTimeout(() => setToast(null), 2500);
    }
  }, [draftText]);

  const headerRight = useMemo(() => {
    if (loadingUser) {
      return (
        <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
          <Spinner />
          Loading…
        </span>
      );
    }
    return (
      <span className="text-xs text-zinc-400">
        {userId ? 'Saved to your account (this browser)' : 'Log in to save per account'}
      </span>
    );
  }, [loadingUser, userId]);

  return (
    <section
      className={`rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-[#0a0c10] shadow-2xl shadow-black/30 ${className}`}
    >
      <div className="flex flex-col gap-2 border-b border-[var(--border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
            AI Priority Engine
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">
            Automatic delay handling + manual issue picks
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Late delivery / trip delay is handled automatically. Select manual issues to unlock actions.
          </p>
        </div>
        <div className="shrink-0">{headerRight}</div>
      </div>

      {/* Mobile: card layout (no horizontal scroll) */}
      <div className="grid gap-4 p-4 sm:p-6 md:hidden">
        {ROWS.map((row) => {
          const manualCount = selectedManualCount(row.key);
          const hasManual = manualCount > 0;
          return (
            <div
              key={row.key}
              className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/40 p-4 shadow-lg shadow-black/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-white">{row.label}</p>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    Issue #1 is auto-handled. Pick manual issues to unlock actions.
                  </p>
                </div>
                <button
                  type="button"
                  disabled
                  className="shrink-0 inline-flex min-h-[34px] items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 text-[11px] font-semibold text-emerald-100 opacity-85"
                  title="Late delivery / trip delay is handled automatically."
                >
                  Handled automatically
                </button>
              </div>

              <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-300" aria-hidden>
                    ✓
                  </span>
                  <span className="text-[12px] font-semibold text-emerald-100">
                    {row.auto.title} {row.auto.badge}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-emerald-200/70">
                  Automatically detected from inbox sync + timestamps.
                </p>
              </div>

              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Manual issues (optional)
                </p>
                <div className="mt-2 grid gap-2">
                  {row.manual.map((m) => (
                    <label
                      key={m.issueKey}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 hover:bg-white/[0.02]"
                    >
                      <span className="text-[12px] text-zinc-200">{m.title}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(sel[row.key]?.[m.issueKey])}
                        onChange={(e) => toggle(row.key, m.issueKey, e.target.checked)}
                        className="h-4 w-4 accent-emerald-400"
                        aria-label={`${row.label}: ${m.title}`}
                      />
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-[var(--muted)]">
                  Selected: <span className="font-medium text-zinc-200">{manualCount}</span>
                </p>
              </div>

              {hasManual ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void onApprove(row.key)}
                    disabled={saving}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[var(--accent)] px-3 text-[12px] font-semibold text-[var(--background)] disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openDraft(row.key)}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-[12px] font-semibold text-zinc-200 hover:bg-white/[0.02]"
                  >
                    Draft message
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Desktop/tablet: wide table */}
      <div className="hidden md:block overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <table className="w-full min-w-[860px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] bg-white/[0.02]">
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-6">
                Platform
              </th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-6">
                Issue #1 (AUTO)
              </th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-6">
                Manual issues (optional)
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-6">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const manualCount = selectedManualCount(row.key);
              const hasManual = manualCount > 0;
              return (
                <tr key={row.key} className="border-b border-[var(--border)]/60 last:border-0">
                  <td className="px-4 py-4 font-semibold text-white sm:px-6">{row.label}</td>

                  <td className="px-4 py-4 sm:px-6">
                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-300" aria-hidden>
                          ✓
                        </span>
                        <span className="font-semibold text-emerald-100">
                          {row.auto.title} {row.auto.badge}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-emerald-200/70">
                        Automatically detected from connected data.
                      </p>
                    </div>
                  </td>

                  <td className="px-4 py-4 sm:px-6">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {row.manual.map((m) => (
                        <label
                          key={m.issueKey}
                          className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 hover:bg-white/[0.02]"
                        >
                          <span className="text-[12px] text-zinc-200">{m.title}</span>
                          <input
                            type="checkbox"
                            checked={Boolean(sel[row.key]?.[m.issueKey])}
                            onChange={(e) => toggle(row.key, m.issueKey, e.target.checked)}
                            className="h-4 w-4 accent-emerald-400"
                            aria-label={`${row.label}: ${m.title}`}
                          />
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-[var(--muted)]">
                      Selected: <span className="font-medium text-zinc-200">{manualCount}</span>
                    </p>
                  </td>

                  <td className="px-4 py-4 text-right sm:px-6">
                    <div className="flex flex-col items-end gap-2">
                      <button
                        type="button"
                        disabled
                        className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 text-[11px] font-semibold text-emerald-100 opacity-80"
                        title="Late delivery / trip delay is handled automatically."
                      >
                        Handled automatically
                      </button>

                      {hasManual ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void onApprove(row.key)}
                            disabled={saving}
                            className="inline-flex min-h-[36px] w-full items-center justify-center rounded-lg bg-[var(--accent)] px-3 text-[11px] font-semibold text-[var(--background)] disabled:opacity-60"
                          >
                            {saving ? 'Saving…' : 'Approve compensation'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openDraft(row.key)}
                            className="inline-flex min-h-[36px] w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[11px] font-semibold text-zinc-200 hover:bg-white/[0.02]"
                          >
                            Draft message
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {toast ? (
        <div className="border-t border-[var(--border)] px-4 py-3 text-xs text-emerald-200 sm:px-6" role="status">
          {toast}
        </div>
      ) : null}

      {draftOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Draft message</p>
                <p className="text-sm font-medium text-white">Copy and paste into support chat or email</p>
              </div>
              <button
                type="button"
                onClick={closeDraft}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.02]"
              >
                Close
              </button>
            </div>
            <div className="space-y-3 px-4 py-4 sm:px-6">
              <textarea
                value={draftLoading ? 'Generating draft…' : draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={10}
                readOnly={draftLoading}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-white"
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => void copyDraft()}
                  disabled={draftLoading || !draftText.trim()}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--background)]"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={closeDraft}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 text-sm font-semibold text-zinc-200 hover:bg-white/[0.02]"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

