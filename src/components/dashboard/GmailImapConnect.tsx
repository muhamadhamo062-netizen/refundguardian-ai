'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

import { GmailSecureSyncGuide } from '@/components/dashboard/GmailSecureSyncGuide';

const TRUST_COPY =
  'Encrypted on our servers. Used only to read invoice-style order emails from supported merchants. You can disconnect anytime.';

/**
 * Mobile-only connection path: save Gmail + App Password to `imap_app_credentials` for the current auth user.
 * Same `user_id` as extension-backed `orders` rows.
 */
export function GmailImapConnect() {
  const [gmail, setGmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [lastScanInserted, setLastScanInserted] = useState<number | null>(null);
  const [lastScanError, setLastScanError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const res = await fetch('/api/user/gmail-imap', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      connected?: boolean;
      gmail_address?: string | null;
      last_scan_at?: string | null;
      last_scan_inserted?: number | null;
      last_scan_error?: string | null;
      error?: string;
    };
    if (body.ok && body.connected) {
      setConnected(true);
      setSavedEmail(body.gmail_address ?? null);
      setLastScanAt(typeof body.last_scan_at === 'string' ? body.last_scan_at : null);
      setLastScanInserted(typeof body.last_scan_inserted === 'number' ? body.last_scan_inserted : null);
      setLastScanError(typeof body.last_scan_error === 'string' ? body.last_scan_error : null);
    } else {
      setConnected(false);
      setSavedEmail(null);
      setLastScanAt(null);
      setLastScanInserted(null);
      setLastScanError(null);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('Sign in again to save Gmail.');
        return;
      }
      const res = await fetch('/api/user/gmail-imap', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gmailAddress: gmail, appPassword }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok !== true) {
        setError(typeof body.error === 'string' ? body.error : 'Could not save.');
        return;
      }
      setAppPassword('');
      setStatus('Gmail saved securely for this account.');
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  const onDisconnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch('/api/user/gmail-imap', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok !== true) {
        setError(typeof body.error === 'string' ? body.error : 'Could not remove.');
        return;
      }
      setConnected(false);
      setSavedEmail(null);
      setLastScanAt(null);
      setLastScanInserted(null);
      setLastScanError(null);
      setStatus('Saved Gmail connection removed.');
    } finally {
      setLoading(false);
    }
  };

  const onScanNow = async () => {
    setScanLoading(true);
    setError(null);
    setStatus(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('Sign in again to scan Gmail.');
        return;
      }
      const res = await fetch('/api/imap/scan-now', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        ordersFound?: number;
        error?: string;
        detail?: string;
      };
      if (!res.ok || body.success !== true) {
        setError(
          typeof body.detail === 'string'
            ? `${body.error || 'Scan failed'}: ${body.detail}`
            : typeof body.error === 'string'
              ? body.error
              : 'Scan failed.'
        );
        await refreshStatus();
        return;
      }
      const n = typeof body.ordersFound === 'number' ? body.ordersFound : 0;
      setStatus(`${n} orders found.`);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan request failed.');
    } finally {
      setScanLoading(false);
    }
  };

  return (
    <div className="w-full max-w-none rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3 shadow-lg shadow-black/20 sm:p-5">
      <div>
        <p className="text-sm font-semibold text-[var(--foreground)]">Secure inbox sync</p>
        <p className="mt-1 text-xs text-[var(--muted)] leading-relaxed">
          One-time setup: paste your <strong className="text-zinc-200">Secure Sync Code</strong> (Google App
          Password). 2-Step Verification must be on. Orders sync to this account — same as the desktop extension when
          you use it.
        </p>
      </div>

      {!connected ? <GmailSecureSyncGuide /> : null}

      {connected ? (
        <p className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          Connected: <span className="font-medium">{savedEmail ?? 'Gmail'}</span>
        </p>
      ) : null}

      {connected ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => void onScanNow()}
            disabled={loading || scanLoading}
            className="w-full min-h-[48px] touch-manipulation rounded-xl bg-white/90 px-4 py-3 text-base font-semibold text-black disabled:opacity-50"
          >
            {scanLoading ? 'Scanning Gmail…' : 'Scan Now'}
          </button>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-zinc-300">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>
                <span className="text-zinc-400">Last scan:</span>{' '}
                {lastScanAt ? new Date(lastScanAt).toLocaleString() : '—'}
              </span>
              <span>
                <span className="text-zinc-400">Last found:</span>{' '}
                {typeof lastScanInserted === 'number' ? lastScanInserted : '—'}
              </span>
            </div>
            {lastScanError ? (
              <div className="mt-1 text-rose-300">Last error: {lastScanError}</div>
            ) : null}
            {!lastScanAt ? (
              <div className="mt-1 text-zinc-400">No orders found yet — run a scan.</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <div>
          <label htmlFor="rg-gmail" className="mb-1 block text-xs text-zinc-400">
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
            className="w-full min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base text-white"
          />
        </div>
        <div>
          <label htmlFor="rg-app-pw" className="mb-1 block text-sm font-medium text-zinc-200">
            Secure Sync Code
          </label>
          <p className="mb-1.5 text-[11px] leading-snug text-zinc-500">
            Invoice-only access — this code does not give us access to your private messages.
          </p>
          <input
            id="rg-app-pw"
            name="appPassword"
            type="password"
            autoComplete="current-password"
            value={appPassword}
            onChange={(e) => setAppPassword(e.target.value)}
            required
            placeholder="16-character code from Google"
            className="w-full min-h-[44px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base text-white"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[48px] touch-manipulation rounded-xl bg-[var(--accent)] px-4 py-3 text-base font-semibold text-[var(--background)] disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save & enable sync'}
        </button>
        <p className="text-[13px] leading-snug text-zinc-500">{TRUST_COPY}</p>
      </form>

      {status ? (
        <p className="text-xs font-medium text-emerald-300" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs font-medium text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      {connected ? (
        <button
          type="button"
          onClick={() => void onDisconnect()}
          disabled={loading}
          className="w-full min-h-[44px] rounded-xl border border-[var(--border)] py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          Remove saved Gmail connection
        </button>
      ) : null}
    </div>
  );
}
