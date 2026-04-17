'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { normalizeAppPassword } from '@/lib/appPasswordNormalize';
import { dispatchDashboardOrdersRefresh } from '@/lib/dashboard/ordersRefresh';

/**
 * Gmail App Password → `imap_app_credentials` (encrypted server-side, isolated by `user_id`).
 * Once connected, we do not ask for the App Password again unless the user disconnects.
 */
type GmailImapConnectProps = {
  onConnectionChange?: (connected: boolean) => void;
  hideWhenConnected?: boolean;
  /** Dashboard bottom strip: primary CTA label. */
  primaryCtaLabel?: string;
  /** Frosted panel inside a glass parent (e.g. dashboard primary action). */
  surface?: 'default' | 'glass';
};

export function GmailImapConnect({
  onConnectionChange,
  hideWhenConnected = false,
  primaryCtaLabel = 'Sync Gmail',
  surface = 'default',
}: GmailImapConnectProps) {
  const [gmail, setGmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [lastScanInserted, setLastScanInserted] = useState<number | null>(null);
  const [lastScanError, setLastScanError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const inputClass =
    surface === 'glass'
      ? 'w-full rounded-xl border border-white/15 bg-black/35 px-4 py-3 text-base text-white placeholder:text-zinc-500 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-violet-400/45'
      : 'w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50';

  const refreshStatus = useCallback(async (): Promise<boolean> => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers: HeadersInit = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    const res = await fetch('/api/user/gmail-imap', {
      credentials: 'include',
      headers,
      cache: 'no-store',
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      connected?: boolean;
      gmail_address?: string | null;
      last_scan_at?: string | null;
      last_scan_inserted?: number | null;
      last_scan_error?: string | null;
    };
    if (body.ok && body.connected) {
      setConnected(true);
      onConnectionChange?.(true);
      setSavedEmail(body.gmail_address ?? null);
      setLastScanAt(typeof body.last_scan_at === 'string' ? body.last_scan_at : null);
      setLastScanInserted(typeof body.last_scan_inserted === 'number' ? body.last_scan_inserted : null);
      setLastScanError(typeof body.last_scan_error === 'string' ? body.last_scan_error : null);
      return true;
    }
    setConnected(false);
    onConnectionChange?.(false);
    setSavedEmail(null);
    setLastScanAt(null);
    setLastScanInserted(null);
    setLastScanError(null);
    return false;
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const normalizedPw = normalizeAppPassword(appPassword);
      const gmailTrim = gmail.trim();
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const postRes = await fetch('/api/user/gmail-imap', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers,
        body: JSON.stringify({ gmailAddress: gmailTrim, appPassword: normalizedPw }),
      });
      setAppPassword('');

      const body = (await postRes.json().catch(() => ({}))) as { ok?: boolean; success?: boolean; error?: string };
      const persisted = await refreshStatus();
      dispatchDashboardOrdersRefresh();

      if (persisted) {
        setShowForm(false);
        setStatus(null);
        const scanHeaders: HeadersInit = {};
        if (session?.access_token) scanHeaders.Authorization = `Bearer ${session.access_token}`;
        void fetch('/api/imap/scan-now', {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: scanHeaders,
        })
          .then(() => refreshStatus())
          .catch(() => void refreshStatus());
      } else {
        setStatus(
          body.error ??
            (!postRes.ok ? 'Could not save Gmail connection. Check server logs and Supabase schema.' : 'Not connected yet — verify credentials.')
        );
      }
    } catch {
      setStatus('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const onDisconnect = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      await fetch('/api/user/gmail-imap', {
        method: 'DELETE',
        credentials: 'include',
        cache: 'no-store',
        headers,
      });
      setConnected(false);
      onConnectionChange?.(false);
      setSavedEmail(null);
      setLastScanAt(null);
      setLastScanInserted(null);
      setLastScanError(null);
      setShowForm(false);
    } finally {
      setLoading(false);
    }
  };

  const onScanNow = async () => {
    setScanLoading(true);
    setStatus(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      const res = await fetch('/api/imap/scan-now', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers,
      });
      const body = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        ordersFound?: number;
      };
      if (res.ok && body.success === true && typeof body.ordersFound === 'number') {
        setStatus(`${body.ordersFound} orders imported.`);
      }
      dispatchDashboardOrdersRefresh();
      await refreshStatus();
    } catch {
      await refreshStatus();
    } finally {
      setScanLoading(false);
    }
  };

  const cardShell =
    surface === 'glass'
      ? 'relative overflow-hidden rounded-xl border border-white/14 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md'
      : 'relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-zinc-950/95 via-[#0c0a12] to-zinc-950/90 shadow-[0_0_42px_rgba(139,92,246,0.18)] ring-1 ring-violet-400/15';

  if (connected && hideWhenConnected) {
    return null;
  }

  if (connected) {
    return (
      <div id="gmail-sync-status" className={`${cardShell} px-5 py-4 sm:px-6`}>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-violet-500/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200/80">Gmail engine</p>
            <p className="mt-1 truncate text-lg font-semibold text-white">{savedEmail ?? 'Running'}</p>
            <p className="mt-1 text-xs text-zinc-500">
              Last scan: {lastScanAt ? new Date(lastScanAt).toLocaleString() : '—'} · Orders:{' '}
              {typeof lastScanInserted === 'number' ? lastScanInserted : '—'}
            </p>
            {lastScanError ? (
              <p className="mt-1 text-xs text-zinc-600" title={lastScanError}>
                Sync will retry automatically.
              </p>
            ) : null}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <button
              type="button"
              onClick={() => void onScanNow()}
              disabled={loading || scanLoading}
              className="w-full min-h-[52px] rounded-xl bg-[var(--accent)] px-5 py-3 text-base font-semibold text-[var(--background)] shadow-lg shadow-emerald-900/20 disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-2.5 sm:text-sm"
            >
              {scanLoading ? 'Scanning…' : 'Scan inbox'}
            </button>
            <button
              type="button"
              onClick={() => void onDisconnect()}
              disabled={loading}
              className="w-full min-h-[52px] rounded-xl border border-[var(--border)] px-4 py-3 text-base font-medium text-zinc-200 hover:bg-white/[0.04] disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-2.5 sm:text-sm"
            >
              Disconnect
            </button>
          </div>
        </div>
        {status ? (
          <p className="relative mt-3 text-sm font-medium text-emerald-300/95" role="status">
            {status}
          </p>
        ) : null}
      </div>
    );
  }

  if (!showForm) {
    return (
      <div className={cardShell}>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-4 -top-8 h-24 w-24 rounded-full bg-violet-500/20 blur-2xl"
        />
        <div className="relative flex flex-col items-stretch gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-6">
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200/80">Gmail sync</p>
            <p className="mt-1 text-base font-semibold text-white">Connect your inbox to import orders</p>
            <p className="mt-0.5 text-sm text-zinc-400">Uses a Google App Password — never your Refyndra password</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              setStatus(null);
            }}
            className="w-full min-h-[52px] shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110 sm:w-auto sm:min-h-0 sm:px-8 sm:py-3"
          >
            {primaryCtaLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${cardShell} p-5 sm:p-6`}>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-4 -bottom-8 h-24 w-24 rounded-full bg-fuchsia-500/10 blur-2xl"
      />
      <div className="relative">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200/80">Gmail setup</p>
            <p className="mt-1 text-lg font-semibold text-white">Connect your inbox</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowForm(false);
              setStatus(null);
            }}
            className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div>
            <label htmlFor="rg-gmail" className="mb-1 block text-sm font-medium text-zinc-400">
              Gmail address
            </label>
            <input
              id="rg-gmail"
              name="email"
              type="email"
              autoComplete="username"
              value={gmail}
              onChange={(e) => setGmail(e.target.value)}
              required
              placeholder="you@gmail.com"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="rg-app-pw" className="mb-1 block text-sm font-medium text-zinc-400">
              Google App Password
            </label>
            <input
              id="rg-app-pw"
              name="appPassword"
              type="password"
              autoComplete="current-password"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              placeholder="16-character app password"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={`${inputClass} font-mono tracking-wide`}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[52px] rounded-xl bg-[var(--accent)] py-3.5 text-base font-bold text-[var(--background)] shadow-lg shadow-emerald-900/20 disabled:opacity-50 touch-manipulation"
          >
            {loading ? 'Connecting…' : 'Save & sync'}
          </button>
        </form>

        {status ? (
          <p className="mt-4 text-sm font-medium text-amber-200/95" role="status">
            {status}
          </p>
        ) : null}
      </div>
    </div>
  );
}
