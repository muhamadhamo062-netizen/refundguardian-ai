'use client';

import Link from 'next/link';
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

/** Suggested merchant inboxes (Uber/DoorDash). Amazon varies — user should enter a valid address. */
const DEFAULT_SUPPORT_TO: Record<PlatformKey, string> = {
  amazon: '',
  uber_eats: 'support@uber.com',
  uber_rides: 'support@uber.com',
  doordash: 'help@doordash.com',
};

const ROWS: RowSpec[] = [
  {
    key: 'amazon',
    label: 'Amazon',
    auto: { title: 'Standard monitoring', badge: '⭐', issueKey: 'late_delivery_auto' },
    manual: [
      { title: 'Missing item', issueKey: 'missing_item' },
      { title: 'Charged incorrectly', issueKey: 'charged_incorrectly' },
      { title: 'Damaged item', issueKey: 'damaged_item' },
    ],
  },
  {
    key: 'uber_eats',
    label: 'Uber Eats',
    auto: { title: 'Standard monitoring', badge: '⭐', issueKey: 'late_delivery_auto' },
    manual: [
      { title: 'Missing item', issueKey: 'missing_item' },
      { title: 'Cold food', issueKey: 'cold_food' },
      { title: 'Charged incorrectly', issueKey: 'charged_incorrectly' },
    ],
  },
  {
    key: 'uber_rides',
    label: 'Uber Rides',
    auto: { title: 'Standard monitoring', badge: '⭐', issueKey: 'trip_delay_auto' },
    manual: [
      { title: 'Charged incorrectly', issueKey: 'charged_incorrectly' },
      { title: 'Trip issue', issueKey: 'trip_issue' },
      { title: 'Driver route issue', issueKey: 'driver_route_issue' },
    ],
  },
  {
    key: 'doordash',
    label: 'DoorDash',
    auto: { title: 'Standard monitoring', badge: '⭐', issueKey: 'late_delivery_auto' },
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

/** Per-user preferences; only meaningful when signed in (dashboard — not on public landing). */
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
  const [toEmail, setToEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [gmailConnectHref, setGmailConnectHref] = useState('/login');
  const [toast, setToast] = useState<string | null>(null);
  /** null = loading; false = template-only; true = AI-assisted drafts */
  const [aiDraftingEnabled, setAiDraftingEnabled] = useState<boolean | null>(null);

  const draftButtonLabel = useMemo(
    () => (aiDraftingEnabled === false ? 'Use guided template' : 'Draft message'),
    [aiDraftingEnabled]
  );

  const refreshAiStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/ai/status', { cache: 'no-store' });
      const d = (await r.json()) as { ok?: boolean; aiDraftingEnabled?: boolean };
      setAiDraftingEnabled(d.aiDraftingEnabled === true);
    } catch {
      setAiDraftingEnabled(false);
    }
  }, []);

  const refreshGmailStatus = useCallback(async () => {
    if (!userId) {
      setGmailConnected(null);
      return;
    }
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setGmailConnected(false);
      return;
    }
    try {
      const r = await fetch('/api/user/gmail-imap', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const d = (await r.json()) as { ok?: boolean; connected?: boolean };
      setGmailConnected(!!d?.connected);
    } catch {
      setGmailConnected(false);
    }
  }, [userId]);

  useEffect(() => {
    void refreshAiStatus();
  }, [refreshAiStatus]);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
      setLoadingUser(false);
      setGmailConnectHref(user ? '/dashboard#gmail-connection' : '/login');
    });
  }, []);

  useEffect(() => {
    void refreshGmailStatus();
  }, [refreshGmailStatus]);

  useEffect(() => {
    const onFocus = () => {
      void refreshGmailStatus();
      void refreshAiStatus();
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void refreshGmailStatus();
        void refreshAiStatus();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refreshAiStatus, refreshGmailStatus]);

  useEffect(() => {
    if (!draftOpen) return;
    setToEmail(DEFAULT_SUPPORT_TO[draftOpen.platform]);
  }, [draftOpen]);

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
        setToast('Select at least one issue above first.');
        window.setTimeout(() => setToast(null), 2500);
        return;
      }

      setDraftOpen({ platform });
      setDraftLoading(true);
      setDraftText('');
      void refreshGmailStatus();

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
          setToast(
            aiDraftingEnabled === false
              ? 'Guided template only — smart drafting can be enabled for your account by your team.'
              : body.error || 'Could not generate a draft. Showing a simple template instead.'
          );
          window.setTimeout(() => setToast(null), 4500);
          return;
        }
        setDraftText(body.draft);
      } catch (e) {
        const fallback = `Hi,\n\nI’m reaching out about my recent ${row?.label ?? 'order'}.\n\nIssue(s): ${selectedKeys.join(
          ', '
        )}\n\nPlease review and assist with an appropriate adjustment.\n\nThanks,\n[Your Name]`;
        setDraftText(fallback);
        setToast(
          aiDraftingEnabled === false
            ? 'Using a simple template — smart drafting isn’t enabled on this account yet.'
            : e instanceof Error
              ? e.message
              : 'Draft request failed. Showing template instead.'
        );
        window.setTimeout(() => setToast(null), 4500);
      } finally {
        setDraftLoading(false);
      }
    },
    [aiDraftingEnabled, refreshGmailStatus, sel]
  );

  const closeDraft = useCallback(() => {
    setDraftOpen(null);
    setDraftText('');
    setDraftLoading(false);
    setSending(false);
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

  const sendDraftFromGmail = useCallback(async () => {
    if (!draftOpen || draftLoading || !draftText.trim()) return;
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setToast('Please log in to send email.');
      window.setTimeout(() => setToast(null), 3000);
      return;
    }
    const trimmedTo = toEmail.trim();
    if (!trimmedTo && draftOpen.platform === 'amazon') {
      setToast('Enter a recipient email for Amazon (or use in-app help).');
      window.setTimeout(() => setToast(null), 3500);
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/ai/send-compensation-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          platform: draftOpen.platform,
          draft: draftText,
          ...(trimmedTo ? { to: trimmedTo } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        sent_to?: string;
      };
      if (!res.ok || body.ok !== true) {
        setToast(body.error || 'Could not send email.');
        window.setTimeout(() => setToast(null), 5000);
        return;
      }
      setToast(
        `Sent to ${body.sent_to ?? trimmedTo}. If the store approves a credit or refund, it will show in your email and Refyndra history — timing varies by merchant.`
      );
      window.setTimeout(() => setToast(null), 6500);
      closeDraft();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Send failed.');
      window.setTimeout(() => setToast(null), 4000);
    } finally {
      setSending(false);
    }
  }, [closeDraft, draftLoading, draftOpen, draftText, toEmail]);

  const headerRight = useMemo(() => {
    if (loadingUser) {
      return (
        <span className="inline-flex items-center gap-2 text-base text-zinc-200 sm:text-xs sm:text-zinc-400">
          <Spinner />
          Loading…
        </span>
      );
    }
    return (
      <span className="text-base text-zinc-200 sm:text-xs sm:text-zinc-400">
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/80 sm:text-[10px]">
            Smart savings
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-white sm:text-xl">
            Standard monitoring &amp; AI Auto-Pilot
          </h2>
          <p className="mt-1 text-base text-[var(--muted)] sm:text-xs">
            {aiDraftingEnabled === false ? (
              <>
                <strong className="font-medium text-zinc-300">Standard monitoring</strong> watches delays for you. Add
                specific issues below, then edit a simple template — smarter drafting can be turned on by your team.
              </>
            ) : aiDraftingEnabled === true ? (
              <>
                <strong className="font-medium text-zinc-300">Standard monitoring</strong> tracks timing issues. Add any
                extra issues — Refyndra can draft a clear message; the store still decides refunds or credits.
              </>
            ) : (
              <>Checking your tools…</>
            )}
          </p>
        </div>
        <div className="shrink-0">{headerRight}</div>
      </div>

      {aiDraftingEnabled === false ? (
        <div className="border-b border-amber-500/25 bg-amber-500/10 px-4 py-3 text-base leading-relaxed text-amber-50 sm:px-6 sm:text-[11px] sm:text-amber-100">
          <strong className="font-semibold text-amber-50">Templates only for now.</strong> Your team can enable
          AI-written messages for all supported stores. Sending still happens from <strong className="font-medium">your</strong>{' '}
          Gmail when connected.
        </div>
      ) : null}

      <div className="border-b border-[var(--border)] bg-white/[0.02] px-4 py-3 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300/90 sm:text-[10px]">Smart flow</p>
        <ol className="mt-2 grid gap-2 text-base font-medium leading-snug text-zinc-200 sm:grid-cols-2 sm:text-[11px] sm:font-normal sm:text-zinc-300 lg:grid-cols-4">
          <li className="flex gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/50 px-2 py-2">
            <span className="shrink-0 font-semibold text-emerald-400">1</span>
            <span>
              <span className="text-zinc-200">Connect Gmail</span> (App Password) so we can send{' '}
              <strong className="font-medium text-white">from your address</strong>.{' '}
              <Link
                href={gmailConnectHref}
                className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
              >
                Open setup
              </Link>
              {gmailConnected === true ? (
                <span className="ml-1 inline-flex items-center rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs font-semibold text-emerald-200 sm:text-[10px] sm:font-medium sm:text-emerald-300">
                  Connected
                </span>
              ) : gmailConnected === false ? (
                <span className="ml-1 inline-flex items-center rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-semibold text-amber-100 sm:text-[10px] sm:font-medium sm:text-amber-200">
                  Not connected
                </span>
              ) : (
                <span className="ml-1 text-zinc-500">…</span>
              )}
            </span>
          </li>
          <li className="flex gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/50 px-2 py-2">
            <span className="shrink-0 font-semibold text-emerald-400">2</span>
            <span>
              Choose <strong className="font-medium text-white">additional issues</strong> for that store (missing item,
              cold food, etc.).
            </span>
          </li>
          <li className="flex gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/50 px-2 py-2">
            <span className="shrink-0 font-semibold text-emerald-400">3</span>
            <span>
              Tap <strong className="font-medium text-white">Draft message</strong>
              {aiDraftingEnabled === false
                ? ' — you fill in a simple template yourself.'
                : aiDraftingEnabled === true
                  ? ' — Refyndra drafts a clear, store-specific message you can edit. Not a guarantee of payment.'
                  : ' — …'}
            </span>
          </li>
          <li className="flex gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/50 px-2 py-2">
            <span className="shrink-0 font-semibold text-emerald-400">4</span>
            <span>
              <strong className="font-medium text-white">Send from my Gmail</strong> or paste into the merchant app.
              If they approve anything, it shows up in your email and in{' '}
              <Link href={userId ? '/dashboard/refund-history' : '/login'} className="font-medium text-[var(--accent)] underline-offset-2 hover:underline">
                Refund history
              </Link>
              .
            </span>
          </li>
        </ol>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300 sm:text-[10px] sm:text-zinc-500">
          {aiDraftingEnabled === false ? (
            <>
              Only <strong className="text-zinc-400">you</strong> send the final message for now. Refyndra never collects
              money from stores for you.
            </>
          ) : (
            <>
              Refyndra never collects money from stores for you. Sending a message starts their process — credits or
              refunds follow their rules.
            </>
          )}
        </p>
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
                  <p className="text-lg font-semibold text-white sm:text-xs">{row.label}</p>
                  <p className="mt-1 text-base text-[var(--muted)] sm:text-[11px]">
                    Standard monitoring is on. Pick additional issues to unlock actions.
                  </p>
                </div>
                <button
                  type="button"
                  disabled
                  className="shrink-0 inline-flex min-h-[40px] items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 text-sm font-bold text-emerald-50 opacity-90 sm:min-h-[34px] sm:text-[11px] sm:font-semibold sm:text-emerald-100 sm:opacity-85"
                  title="Standard monitoring is active from your connected activity."
                >
                  Standard monitoring
                </button>
              </div>

              <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-300" aria-hidden>
                    ✓
                  </span>
                  <span className="text-base font-bold text-emerald-50 sm:text-[12px] sm:font-semibold sm:text-emerald-100">
                    {row.auto.title} {row.auto.badge}
                  </span>
                </div>
                <p className="mt-1 text-base font-medium text-emerald-100 sm:text-[11px] sm:font-normal sm:text-emerald-200/70">
                  Detected from extension + timestamps.
                </p>
              </div>

              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300 sm:text-[10px] sm:text-[var(--muted)]">
                  Additional issues (optional)
                </p>
                <div className="mt-2 grid gap-2">
                  {row.manual.map((m) => (
                    <label
                      key={m.issueKey}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 hover:bg-white/[0.02] sm:py-2"
                    >
                      <span className="text-base font-medium text-zinc-100 sm:text-[12px] sm:font-normal sm:text-zinc-200">
                        {m.title}
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(sel[row.key]?.[m.issueKey])}
                        onChange={(e) => toggle(row.key, m.issueKey, e.target.checked)}
                        className="h-5 w-5 accent-emerald-400 sm:h-4 sm:w-4"
                        aria-label={`${row.label}: ${m.title}`}
                      />
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-base text-[var(--muted)] sm:text-[11px]">
                  Selected: <span className="font-semibold text-zinc-100 sm:font-medium sm:text-zinc-200">{manualCount}</span>
                </p>
              </div>

              {hasManual ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void onApprove(row.key)}
                    disabled={saving}
                    className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[var(--accent)] px-3 text-base font-bold text-[var(--background)] disabled:opacity-60 sm:min-h-[40px] sm:text-[12px] sm:font-semibold"
                  >
                    {saving ? 'Saving…' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openDraft(row.key)}
                    className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-base font-bold text-zinc-100 hover:bg-white/[0.02] sm:min-h-[40px] sm:text-[12px] sm:font-semibold sm:text-zinc-200"
                  >
                    {draftButtonLabel}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Desktop/tablet: wide table */}
      <div className="hidden md:block overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm sm:text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] bg-white/[0.02]">
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-6">
                Platform
              </th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-6">
                Standard monitoring
              </th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-6">
                Additional issues (optional)
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
                  <td className="px-4 py-4 text-base font-bold text-white sm:px-6 sm:text-sm sm:font-semibold">{row.label}</td>

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
                        Detected from connected data.
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
                          <span className="text-sm font-medium text-zinc-100 sm:text-[12px] sm:font-normal sm:text-zinc-200">
                            {m.title}
                          </span>
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
                        title="Standard monitoring is active from your connected activity."
                      >
                        Standard monitoring
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
                            {draftButtonLabel}
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
        <div className="border-t border-[var(--border)] px-4 py-3 text-base font-medium text-emerald-100 sm:px-6 sm:text-xs sm:font-normal sm:text-emerald-200" role="status">
          {toast}
        </div>
      ) : null}

      {draftOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[min(92dvh,100%)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl shadow-black/40 sm:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3 sm:px-6">
              <div className="min-w-0 pr-2">
                <p className="text-sm font-semibold uppercase tracking-wider text-zinc-300 sm:text-xs sm:text-zinc-400">
                  {aiDraftingEnabled === false ? 'Guided template' : 'Smart draft'}
                </p>
                <p className="text-lg font-semibold text-white sm:text-sm sm:font-medium">
                  {aiDraftingEnabled === false
                    ? 'You edit the message'
                    : 'Polished message — send or copy'}
                </p>
                <p className="mt-0.5 text-base text-zinc-300 sm:text-[11px] sm:text-zinc-500">
                  {aiDraftingEnabled === false ? (
                    <>
                      Smarter drafting can be enabled for your Refyndra account. Stores still decide every outcome.
                    </>
                  ) : (
                    <>
                      Approval of any refund or credit is up to the store. We help you ask clearly — we don’t guarantee
                      an outcome.
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDraft}
                className="min-h-[48px] shrink-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base font-semibold text-zinc-100 hover:bg-white/[0.02] sm:min-h-0 sm:py-1.5 sm:text-xs sm:font-normal sm:text-zinc-200"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
              {gmailConnected === false ? (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-base text-amber-50 sm:text-xs sm:text-amber-100">
                  Connect Gmail (App Password) in{' '}
                  <Link href={gmailConnectHref} className="font-medium text-amber-50 underline underline-offset-2">
                    dashboard setup
                  </Link>{' '}
                  to send from your address. You can still copy the text below — works on mobile and desktop.
                </p>
              ) : null}
              <div>
                <label htmlFor="comp-draft-to" className="mb-1 block text-base font-semibold text-zinc-200 sm:text-xs sm:font-medium sm:text-zinc-400">
                  To (merchant support)
                </label>
                <input
                  id="comp-draft-to"
                  type="email"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder={
                    draftOpen?.platform === 'amazon'
                      ? 'e.g. address from Help → Contact (if available)'
                      : 'Pre-filled where we have a common inbox'
                  }
                  disabled={draftLoading || sending}
                  className="w-full min-h-[48px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base text-white placeholder:text-zinc-600 sm:min-h-0 sm:text-sm"
                  autoComplete="email"
                  inputMode="email"
                />
              </div>
              <textarea
                value={draftLoading ? 'Generating draft…' : draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={10}
                readOnly={draftLoading}
                className="w-full min-h-[200px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base text-white sm:text-sm"
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <button
                  type="button"
                  onClick={() => void sendDraftFromGmail()}
                  disabled={
                    draftLoading ||
                    sending ||
                    !draftText.trim() ||
                    gmailConnected === false ||
                    (draftOpen?.platform === 'amazon' && !toEmail.trim())
                  }
                  className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-base font-semibold text-[var(--background)] disabled:opacity-50 sm:min-h-[40px] sm:w-auto sm:text-sm"
                >
                  {sending ? 'Sending…' : 'Send from my Gmail'}
                </button>
                <button
                  type="button"
                  onClick={() => void copyDraft()}
                  disabled={draftLoading || !draftText.trim() || sending}
                  className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 text-base font-semibold text-zinc-200 hover:bg-white/[0.02] disabled:opacity-50 sm:min-h-[40px] sm:w-auto sm:text-sm"
                >
                  Copy text
                </button>
                <button
                  type="button"
                  onClick={closeDraft}
                  disabled={sending}
                  className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 text-base font-semibold text-zinc-200 hover:bg-white/[0.02] disabled:opacity-50 sm:min-h-[40px] sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

