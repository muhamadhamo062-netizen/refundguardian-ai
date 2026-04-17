'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PlatformOrderIcon } from '@/components/dashboard/PlatformOrderIcon';
import type { RefundPlatform } from '@/lib/refundPriorityEngine';
import {
  AI_PRIORITY_ROWS as ROWS,
  DEFAULT_SUPPORT_TO,
  type PlatformKey,
  type IssueKey,
  type SelectionState,
  emptyAiPrioritySelection as emptySelection,
  aiPriorityStorageKey as storageKey,
} from '@/lib/ai/aiPriorityEngineConfig';

type ComplaintStatus = 'idle' | 'generating' | 'generated' | 'failed';
type ComplaintState = {
  status: ComplaintStatus;
  complaint: string;
  tone?: string;
};

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-emerald-400"
      aria-hidden
    />
  );
}

function AutoPilotGoldStars({ textSizeClass = 'text-[15px]' }: { textSizeClass?: string }) {
  return (
    <span className={`inline-flex gap-0.5 leading-none tracking-tight ${textSizeClass}`} aria-hidden title="Auto-Pilot">
      {[0, 1].map((i) => (
        <span
          key={i}
          className="inline-block text-amber-300 [filter:drop-shadow(0_0_8px_rgba(251,191,36,0.85))]"
          style={{ textShadow: '0 0 14px rgba(253, 224, 71, 0.65)' }}
        >
          ⭐
        </span>
      ))}
    </span>
  );
}

export function AiPriorityEngineTable({
  className = '',
  commandCenter = false,
  slimDashboard = false,
}: {
  className?: string;
  /** Hides long onboarding copy; tighter actions (dashboard command center). */
  commandCenter?: boolean;
  /** Single slim table: one row per platform; Send Auto-Draft; gold stars on auto. */
  slimDashboard?: boolean;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [sel, setSel] = useState<SelectionState>(() => emptySelection());
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
  const [complaints, setComplaints] = useState<Record<PlatformKey, ComplaintState>>({
    amazon: { status: 'idle', complaint: '' },
    uber_eats: { status: 'idle', complaint: '' },
    uber_rides: { status: 'idle', complaint: '' },
    doordash: { status: 'idle', complaint: '' },
  });

  const draftButtonLabel = slimDashboard
    ? 'Send Auto-Draft'
    : commandCenter
      ? 'Draft'
      : 'Draft message';

  const refreshGmailStatus = useCallback(async () => {
    if (!userId) {
      setGmailConnected(null);
      return;
    }
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers: HeadersInit = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    try {
      const r = await fetch('/api/user/gmail-imap', {
        credentials: 'include',
        headers,
      });
      const d = (await r.json()) as { ok?: boolean; connected?: boolean };
      setGmailConnected(!!d?.connected);
    } catch {
      setGmailConnected(false);
    }
  }, [userId]);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
      setLoadingUser(false);
      setGmailConnectHref(user ? '/dashboard#gmail-engine' : '/login');
    });
  }, []);

  useEffect(() => {
    void refreshGmailStatus();
  }, [refreshGmailStatus]);

  useEffect(() => {
    const onFocus = () => {
      void refreshGmailStatus();
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void refreshGmailStatus();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refreshGmailStatus]);

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
    async (platform: PlatformKey): Promise<string | null> => {
      const row = ROWS.find((r) => r.key === platform);
      const manual = sel[platform] || {};
      const selectedKeys = row?.manual.filter((m) => manual[m.issueKey]).map((m) => m.issueKey) ?? [];
      if (!selectedKeys.length) {
        setToast('Select at least one issue above first.');
        window.setTimeout(() => setToast(null), 2500);
        return null;
      }

      setDraftOpen({ platform });
      setDraftLoading(true);
      setDraftText('');
      setComplaints((cur) => ({
        ...cur,
        [platform]: { ...cur[platform], status: 'generating' },
      }));
      void refreshGmailStatus();

      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
        const res = await fetch('/api/ai/draft-compensation', {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({ platform, manualIssues: selectedKeys }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          draft?: string;
          error?: string;
          complaint_tone?: string;
        };
        if (!res.ok || body.ok !== true || typeof body.draft !== 'string') {
          const fallback = `Hi,\n\nI’m reaching out about my recent ${row?.label ?? 'order'}.\n\nIssue(s): ${selectedKeys.join(
            ', '
          )}\n\nPlease review and assist with an appropriate adjustment.\n\nThanks,\n[Your Name]`;
          setDraftText(fallback);
          setComplaints((cur) => ({
            ...cur,
            [platform]: { ...cur[platform], status: 'failed', complaint: fallback },
          }));
          setToast(body.error || 'Could not generate a draft. Showing a simple template instead.');
          window.setTimeout(() => setToast(null), 4500);
          return fallback;
        }
        setDraftText(body.draft);
        setComplaints((cur) => ({
          ...cur,
          [platform]: {
            status: 'generated',
            complaint: body.draft,
            tone: body.complaint_tone,
          },
        }));
        return body.draft;
      } catch (e) {
        const fallback = `Hi,\n\nI’m reaching out about my recent ${row?.label ?? 'order'}.\n\nIssue(s): ${selectedKeys.join(
          ', '
        )}\n\nPlease review and assist with an appropriate adjustment.\n\nThanks,\n[Your Name]`;
        setDraftText(fallback);
        setComplaints((cur) => ({
          ...cur,
          [platform]: { ...cur[platform], status: 'failed', complaint: fallback },
        }));
        setToast(
          e instanceof Error ? e.message : 'Draft request failed. Showing template instead.'
        );
        window.setTimeout(() => setToast(null), 4500);
        return fallback;
      } finally {
        setDraftLoading(false);
      }
    },
    [refreshGmailStatus, sel]
  );

  const copyAiComplaint = useCallback(
    async (platform: PlatformKey) => {
      const existing = complaints[platform];
      let text = existing?.complaint?.trim() ?? '';
      if (!text) {
        const generated = await openDraft(platform);
        text = generated?.trim() ?? '';
      }
      if (!text) {
        setToast('No complaint available yet.');
        window.setTimeout(() => setToast(null), 2500);
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        setToast('AI complaint copied.');
      } catch {
        setToast('Could not copy complaint.');
      } finally {
        window.setTimeout(() => setToast(null), 2500);
      }
    },
    [complaints, openDraft]
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
    const trimmedTo = toEmail.trim();
    if (!trimmedTo && draftOpen.platform === 'amazon') {
      setToast('Enter a recipient email for Amazon (or use in-app help).');
      window.setTimeout(() => setToast(null), 3500);
      return;
    }
    setSending(true);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      const res = await fetch('/api/ai/send-compensation-draft', {
        method: 'POST',
        credentials: 'include',
        headers,
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
        {userId ? 'Selections saved on this device' : 'Sign in to sync preferences'}
      </span>
    );
  }, [loadingUser, userId]);

  return (
    <section
      className={
        slimDashboard
          ? `rounded-xl border border-white/12 bg-zinc-950/50 shadow-[0_8px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm ${className}`
          : `rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-[#0a0c10] shadow-2xl shadow-black/30 ${className}`
      }
    >
      {slimDashboard ? (
        <div className="flex flex-col gap-2 border-b border-emerald-500/20 bg-emerald-950/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400/95 sm:text-[10px]">
              Compact AI engine
            </p>
            <p className="mt-1 text-base leading-relaxed text-zinc-200 sm:text-xs sm:text-zinc-400">
              Auto-Pilot watches delivery timing — no action needed. Select a manual issue to unlock{' '}
              <span className="font-semibold text-white">Send Auto-Draft</span> with your order details pre-filled.
            </p>
          </div>
          <div className="shrink-0 text-base sm:text-xs">{headerRight}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 border-b border-[var(--border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/80 sm:text-[10px]">
              {commandCenter ? 'AI priority engine' : 'Savings tools'}
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-white sm:text-xl">
              {commandCenter ? 'Manual & automatic issues' : 'Priority engine & drafts'}
            </h2>
            <p className="mt-1 text-base text-[var(--muted)] sm:text-xs">
              {commandCenter ? (
                <>
                  <strong className="font-medium text-zinc-300">Late delivery</strong> and{' '}
                  <strong className="font-medium text-zinc-300">trip delays</strong> are monitored automatically. Select
                  additional issues below, then <strong className="font-medium text-zinc-300">Approve</strong> or{' '}
                  <strong className="font-medium text-zinc-300">Draft</strong> to move forward.
                </>
              ) : (
                <>
                  <strong className="font-medium text-zinc-300">Standard monitoring</strong> tracks timing signals from
                  synced orders. Add optional issues — Refyndra can draft a firm, factual message you edit before
                  anything is sent. Stores always decide refunds or credits.
                </>
              )}
            </p>
          </div>
          <div className="shrink-0">{headerRight}</div>
        </div>
      )}

      {!slimDashboard && !commandCenter ? (
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
              {' — '}
              Refyndra drafts a clear, store-specific message you can edit. Not a guarantee of payment.
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
          Only <strong className="text-zinc-400">you</strong> send the final message. Refyndra never collects money from
          stores for you — credits or refunds follow each merchant&apos;s rules.
        </p>
      </div>
      ) : null}

      {slimDashboard ? (
        <>
          <div className="grid grid-cols-1 gap-4 p-3 md:hidden">
            {ROWS.map((row) => {
              const manualCount = selectedManualCount(row.key);
              const hasManual = manualCount > 0;
              const iconPlat = row.key as unknown as RefundPlatform;
              return (
                <article
                  key={row.key}
                  className="rounded-2xl border border-white/15 bg-white/[0.06] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl"
                >
                  <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                    <PlatformOrderIcon platform={iconPlat} size="compact" />
                    <span className="text-lg font-bold text-white sm:text-base">{row.label}</span>
                  </div>

                  <div className="mt-4 space-y-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Auto-Pilot</p>
                      <div className="mt-3 flex flex-col gap-2">
                        <AutoPilotGoldStars textSizeClass="text-lg" />
                        <p className="text-base font-medium leading-snug text-emerald-100">{row.auto.title}</p>
                        <button
                          type="button"
                          disabled
                          className="w-full min-h-[48px] rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100"
                          title="Monitored automatically — no action required."
                        >
                          Handled automatically
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Manual</p>
                      <div className="mt-3 flex flex-col gap-2">
                        {row.manual.map((m) => (
                          <label
                            key={m.issueKey}
                            className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-zinc-700/80 bg-zinc-950/60 px-3 py-2.5 text-base text-zinc-100 active:bg-white/[0.06]"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(sel[row.key]?.[m.issueKey])}
                              onChange={(e) => toggle(row.key, m.issueKey, e.target.checked)}
                              className="h-5 w-5 shrink-0 accent-emerald-400"
                            />
                            {m.title}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      {hasManual ? (
                        <button
                          type="button"
                          onClick={() => void openDraft(row.key)}
                          className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 via-violet-500 to-fuchsia-500 px-4 py-3 text-base font-bold text-white shadow-[0_0_22px_rgba(139,92,246,0.45)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-violet-400/50 active:scale-[0.98] touch-manipulation"
                        >
                          {draftButtonLabel}
                        </button>
                      ) : (
                        <p className="text-center text-base text-zinc-500">Select at least one issue above</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto p-2 md:block sm:p-3">
            <table className="w-full min-w-[820px] border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="px-2 py-2 font-semibold">Platform</th>
                  <th className="px-2 py-2 font-semibold">Auto-Pilot</th>
                  <th className="px-2 py-2 font-semibold">Manual</th>
                  <th className="px-2 py-2 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const manualCount = selectedManualCount(row.key);
                  const hasManual = manualCount > 0;
                  const iconPlat = row.key as unknown as RefundPlatform;
                  return (
                    <tr key={row.key} className="border-b border-white/[0.06] last:border-0">
                      <td className="px-2 py-2 align-top">
                        <div className="flex items-center gap-2">
                          <PlatformOrderIcon platform={iconPlat} size="compact" />
                          <span className="font-semibold text-zinc-100">{row.label}</span>
                        </div>
                      </td>
                      <td className="max-w-[200px] px-2 py-2 align-top">
                        <div className="flex flex-col gap-1.5">
                          <AutoPilotGoldStars />
                          <span className="font-medium text-emerald-200/95">{row.auto.title}</span>
                          <button
                            type="button"
                            disabled
                            className="w-fit rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-100/90 opacity-90"
                            title="Monitored automatically — no action required."
                          >
                            Handled automatically
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <div className="flex flex-wrap gap-1">
                          {row.manual.map((m) => (
                            <label
                              key={m.issueKey}
                              className="inline-flex cursor-pointer items-center gap-1 rounded border border-zinc-700/80 bg-zinc-950/60 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-white/[0.04]"
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(sel[row.key]?.[m.issueKey])}
                                onChange={(e) => toggle(row.key, m.issueKey, e.target.checked)}
                                className="h-3 w-3 accent-emerald-400"
                              />
                              {m.title}
                            </label>
                          ))}
                        </div>
                      </td>
                      <td className="px-2 py-2 align-top text-right">
                        {hasManual ? (
                          <button
                            type="button"
                            onClick={() => void openDraft(row.key)}
                            className="inline-flex min-h-[36px] min-w-[7.5rem] items-center justify-center rounded-lg bg-gradient-to-r from-violet-600 via-violet-500 to-fuchsia-500 px-3 py-1.5 text-[10px] font-bold text-white shadow-[0_0_22px_rgba(139,92,246,0.45)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-violet-400/50 active:scale-[0.98]"
                          >
                            {draftButtonLabel}
                          </button>
                        ) : (
                          <span className="text-[10px] text-zinc-600">Select an issue</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
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
                  title="AI monitors timing signals automatically — no action required."
                >
                  Handled automatically
                </button>
              </div>

              <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <AutoPilotGoldStars />
                  <span className="text-base font-bold text-emerald-50 sm:text-[12px] sm:font-semibold sm:text-emerald-100">
                    {row.auto.title}
                    {row.auto.badge ? ` ${row.auto.badge}` : ''}
                  </span>
                </div>
                <p className="mt-1 text-base font-medium text-emerald-100 sm:text-[11px] sm:font-normal sm:text-emerald-200/70">
                  Handled automatically using your synced orders.
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
                <p className="mt-1 text-sm text-zinc-400 sm:text-[11px]">
                  Complaint status:{' '}
                  <span className="font-semibold text-zinc-200">
                    {complaints[row.key]?.status === 'generated'
                      ? 'Generated'
                      : complaints[row.key]?.status === 'generating'
                        ? 'Generating'
                        : complaints[row.key]?.status === 'failed'
                          ? 'Fallback ready'
                          : 'Not generated'}
                  </span>
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
                  {!commandCenter ? (
                    <button
                      type="button"
                      onClick={() => void copyAiComplaint(row.key)}
                      className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 text-base font-bold text-emerald-100 hover:bg-emerald-500/15 sm:min-h-[40px] sm:text-[12px] sm:font-semibold"
                    >
                      Copy AI Complaint
                    </button>
                  ) : null}
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
                Auto-Pilot
              </th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-6">
                Additional issues (optional)
              </th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-6">
                Complaint status
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
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <AutoPilotGoldStars textSizeClass="text-[14px]" />
                        <span className="font-semibold text-emerald-100">
                          {row.auto.title}
                          {row.auto.badge ? ` ${row.auto.badge}` : ''}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-emerald-200/70">Handled automatically</p>
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

                  <td className="px-4 py-4 sm:px-6">
                    <span className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[11px] text-zinc-300">
                      {complaints[row.key]?.status === 'generated'
                        ? `Generated${complaints[row.key]?.tone ? ` (${complaints[row.key]?.tone})` : ''}`
                        : complaints[row.key]?.status === 'generating'
                          ? 'Generating...'
                          : complaints[row.key]?.status === 'failed'
                            ? 'Fallback ready'
                            : 'Not generated'}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-right sm:px-6">
                    <div className="flex flex-col items-end gap-2">
                      <button
                        type="button"
                        disabled
                        className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 text-[11px] font-semibold text-emerald-100 opacity-90"
                        title="AI monitors timing signals automatically — no action required."
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
                            {saving ? 'Saving…' : commandCenter ? 'Approve' : 'Approve compensation'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openDraft(row.key)}
                            className="inline-flex min-h-[36px] w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[11px] font-semibold text-zinc-200 hover:bg-white/[0.02]"
                          >
                            {draftButtonLabel}
                          </button>
                          {!commandCenter ? (
                            <button
                              type="button"
                              onClick={() => void copyAiComplaint(row.key)}
                              className="inline-flex min-h-[36px] w-full items-center justify-center rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/15"
                            >
                              Copy AI Complaint
                            </button>
                          ) : null}
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
        </>
      )}

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
                  {slimDashboard ? 'Smart draft' : 'Draft'}
                </p>
                <p className="text-lg font-semibold text-white sm:text-sm sm:font-medium">
                  {slimDashboard ? 'Review, then send from your Gmail' : 'Polished message — send or copy'}
                </p>
                <p className="mt-0.5 text-base text-zinc-300 sm:text-[11px] sm:text-zinc-500">
                  Refunds and credits are always at the merchant&apos;s discretion. Refyndra helps you ask clearly — we
                  don&apos;t guarantee an outcome.
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
                  Add Gmail with an App Password under{' '}
                  <Link href={gmailConnectHref} className="font-medium text-amber-50 underline underline-offset-2">
                    Primary action
                  </Link>{' '}
                  to send from your own address. You can still copy the message below on any device.
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
                  className={
                    slimDashboard
                      ? 'inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-gradient-to-r from-violet-600 via-violet-500 to-fuchsia-500 px-4 text-base font-semibold text-white shadow-[0_0_24px_rgba(139,92,246,0.4)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-violet-400/45 disabled:opacity-50 sm:min-h-[40px] sm:w-auto sm:text-sm'
                      : 'inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-base font-semibold text-[var(--background)] disabled:opacity-50 sm:min-h-[40px] sm:w-auto sm:text-sm'
                  }
                >
                  {sending ? 'Sending…' : slimDashboard ? 'Send draft' : 'Send from my Gmail'}
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

