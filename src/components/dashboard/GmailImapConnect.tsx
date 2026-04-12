'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isPlausibleAppPasswordLength, normalizeAppPassword } from '@/lib/appPasswordNormalize';

import { GmailSecureSyncGuide } from '@/components/dashboard/GmailSecureSyncGuide';
import { MobileSyncVisualStrip } from '@/components/dashboard/MobileSyncVisualStrip';

const TRUST_COPY =
  'Encrypted on our servers. Used only to read invoice-style order emails from supported merchants. You can disconnect anytime.';

const BTN_MOBILE_SYNC =
  'w-full min-h-[52px] touch-manipulation rounded-xl bg-emerald-500 px-4 py-3.5 text-base font-bold text-[#052e16] shadow-[0_0_32px_rgba(16,185,129,0.42)] ring-2 ring-emerald-400/50 transition hover:bg-emerald-400 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-50';

/**
 * Gmail + App Password → `imap_app_credentials` (IMAP ingest + SMTP for send-from-Gmail where enabled).
 */
export function GmailImapConnect({ variant = 'default' }: { variant?: 'default' | 'mobileSync' } = {}) {
  const mobileSync = variant === 'mobileSync';

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
  /** Mobile: reveal visual guide + form only after explicit “Connect Gmail”. */
  const [connectGmailOpen, setConnectGmailOpen] = useState(false);

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

  useEffect(() => {
    if (connected) setConnectGmailOpen(false);
  }, [connected]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const normalizedPw = normalizeAppPassword(appPassword);
      if (!isPlausibleAppPasswordLength(normalizedPw)) {
        setError(
          'Paste the full App Password (about 16 characters). Spaces from your clipboard are OK — we remove them automatically.'
        );
        return;
      }
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
        body: JSON.stringify({ gmailAddress: gmail.trim(), appPassword: normalizedPw }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok !== true) {
        setError(typeof body.error === 'string' ? body.error : 'Could not save.');
        return;
      }
      setAppPassword('');
      setStatus('Gmail saved — scanning your inbox for the last 14 days…');
      await refreshStatus();

      try {
        const scanRes = await fetch('/api/imap/scan-now', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const scanBody = (await scanRes.json().catch(() => ({}))) as {
          success?: boolean;
          ordersFound?: number;
          error?: string;
        };
        if (scanRes.ok && scanBody.success === true && typeof scanBody.ordersFound === 'number') {
          setStatus(
            scanBody.ordersFound > 0
              ? `Gmail connected — synced ${scanBody.ordersFound} order(s).`
              : 'Gmail connected — scanned; no matching order emails in the last 14 days yet.'
          );
        } else if (!scanRes.ok) {
          setStatus('Gmail saved. Pull to refresh or tap Scan Now in a moment.');
        }
      } catch {
        setStatus('Gmail saved. Use Scan Now if orders do not appear within a minute.');
      }
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

  const inputGmailClass = mobileSync
    ? 'w-full min-h-[52px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-lg text-white placeholder:text-zinc-600'
    : 'w-full min-h-[52px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3.5 text-lg text-white placeholder:text-zinc-500 sm:min-h-[44px] sm:px-3 sm:py-2 sm:text-base sm:placeholder:text-[var(--muted)]';

  const inputPwClass = mobileSync
    ? 'w-full min-h-[60px] rounded-xl border-2 border-emerald-500/35 bg-[var(--background)] px-4 py-4 font-mono text-lg leading-relaxed tracking-wide text-white placeholder:text-zinc-600'
    : 'w-full min-h-[56px] rounded-xl border-2 border-emerald-500/30 bg-[var(--background)] px-4 py-3.5 font-mono text-lg leading-relaxed tracking-wide text-white placeholder:text-zinc-500 sm:min-h-[44px] sm:border sm:border-[var(--border)] sm:px-3 sm:py-2 sm:text-base sm:placeholder:text-[var(--muted)]';

  return (
    <div
      className={`w-full max-w-none rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-lg shadow-black/20 sm:p-5 ${mobileSync ? 'space-y-4 p-4' : 'space-y-3 p-4'}`}
    >
      {!connected && mobileSync ? <MobileSyncVisualStrip /> : null}

      {!mobileSync ? (
        <div>
          <p className="text-base font-semibold text-zinc-50 sm:text-sm sm:text-[var(--foreground)]">Secure inbox sync</p>
          <p className="mt-1 text-base text-[var(--muted)] leading-relaxed sm:text-xs">
            One-time setup: paste your <strong className="text-zinc-200">Secure Sync Code</strong> (Google App
            Password). 2-Step Verification must be on. This also unlocks{' '}
            <strong className="text-zinc-200">Send from my Gmail</strong> in the AI Priority Engine (draft with AI,
            send from your address). Orders sync to this account alongside the browser connection. Background scans run
            on a schedule; use <strong className="text-zinc-200">Scan Now</strong> for an immediate pull.
          </p>
        </div>
      ) : !connected && mobileSync && !connectGmailOpen ? (
        <div className="space-y-3 text-center">
          <p className="text-base leading-relaxed text-zinc-200 sm:text-sm sm:text-zinc-400">
            Link Gmail with a secure App Password — no app install. Tap below to see the setup steps and enter your
            details.
          </p>
          <button
            type="button"
            onClick={() => setConnectGmailOpen(true)}
            className={BTN_MOBILE_SYNC}
          >
            Connect Gmail
          </button>
        </div>
      ) : !connected && mobileSync && connectGmailOpen ? (
        <p className="text-center text-base leading-relaxed text-zinc-200 sm:text-sm sm:text-zinc-400">
          Enter your Gmail and paste your secure code below — we encrypt it and only read delivery-related receipts.
        </p>
      ) : null}

      {!connected && !mobileSync ? <GmailSecureSyncGuide /> : null}

      {connected ? (
        <p className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-base text-emerald-50 sm:text-sm sm:text-emerald-100">
          Connected: <span className="font-medium">{savedEmail ?? 'Gmail'}</span>
        </p>
      ) : null}

      {connected ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => void onScanNow()}
            disabled={loading || scanLoading}
            className={
              mobileSync
                ? BTN_MOBILE_SYNC
                : 'w-full min-h-[48px] touch-manipulation rounded-xl bg-white/90 px-4 py-3 text-base font-semibold text-black disabled:opacity-50'
            }
          >
            {scanLoading ? 'Scanning Gmail…' : mobileSync ? 'Sync Now' : 'Scan Now'}
          </button>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base text-zinc-200 sm:text-xs sm:text-zinc-300">
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
          {mobileSync ? (
            <p className="text-center text-sm font-semibold tracking-wide text-emerald-100 sm:text-[11px] sm:font-medium sm:text-emerald-200/90">
              🔒 Bank-Level Encryption
            </p>
          ) : null}
        </div>
      ) : null}

      {!connected && (!mobileSync || connectGmailOpen) ? (
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          <div>
            <label htmlFor="rg-gmail" className={`mb-1 block ${mobileSync ? 'text-sm font-medium text-zinc-300' : 'text-base font-semibold text-zinc-100 sm:text-xs sm:font-normal sm:text-zinc-400'}`}>
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
              className={inputGmailClass}
            />
          </div>
          <div>
            <label htmlFor="rg-app-pw" className={`mb-1 block ${mobileSync ? 'text-sm font-semibold text-zinc-100' : 'text-base font-bold text-zinc-50 sm:text-sm sm:font-medium sm:text-zinc-200'}`}>
              {mobileSync ? 'App password (16 characters)' : 'Secure Sync Code'}
            </label>
            {!mobileSync ? (
              <p className="mb-1.5 text-base leading-snug text-zinc-300 sm:text-[11px] sm:text-zinc-500">
                Invoice-only access — this code does not give us access to your private messages.
              </p>
            ) : (
              <p className="mb-2 text-base leading-snug text-zinc-300 sm:text-[11px] sm:text-zinc-500">
                Paste the code from Google — spaces are fine.
              </p>
            )}
            <input
              id="rg-app-pw"
              name="appPassword"
              type="password"
              autoComplete="current-password"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              required
              placeholder={mobileSync ? 'Paste your 16-character code' : 'xxxx xxxx xxxx xxxx (spaces OK)'}
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={inputPwClass}
            />
          </div>
          <button type="submit" disabled={loading} className={mobileSync ? BTN_MOBILE_SYNC : 'w-full min-h-[48px] touch-manipulation rounded-xl bg-[var(--accent)] px-4 py-3 text-base font-semibold text-[var(--background)] disabled:opacity-50'}>
            {loading ? 'Saving…' : mobileSync ? 'Sync Now' : 'Save & enable sync'}
          </button>
          {mobileSync ? (
            <p className="text-center text-sm font-semibold tracking-wide text-emerald-100 sm:text-[11px] sm:font-medium sm:text-emerald-200/90">
              🔒 Bank-Level Encryption
            </p>
          ) : (
            <p className="text-base leading-snug text-zinc-300 sm:text-[13px] sm:text-zinc-500">{TRUST_COPY}</p>
          )}
        </form>
      ) : null}

      {status ? (
        <p className="text-base font-semibold text-emerald-200 sm:text-xs sm:font-medium sm:text-emerald-300" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="text-base font-semibold text-rose-200 sm:text-xs sm:font-medium sm:text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      {connected ? (
        <button
          type="button"
          onClick={() => void onDisconnect()}
          disabled={loading}
          className="w-full min-h-[48px] rounded-xl border border-[var(--border)] py-3 text-base font-semibold text-zinc-100 hover:bg-zinc-800 disabled:opacity-50 sm:min-h-[44px] sm:py-2.5 sm:text-sm sm:font-normal sm:text-zinc-300"
        >
          Remove saved Gmail connection
        </button>
      ) : null}
    </div>
  );
}
