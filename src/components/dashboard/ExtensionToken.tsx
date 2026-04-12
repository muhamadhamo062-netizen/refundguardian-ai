'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  fetchUsPlatformStats,
  formatCents,
  US_PLATFORMS,
  type UsPlatformStats,
} from '@/lib/dashboardPlatformStats';
import { getChromeWebStoreUrl, MERCHANT_SEED_URLS } from '@/lib/extensionSetup';

const TOKEN_PUSH_DELAYS_MS = [0, 300, 600, 1200];
const PROBE_TIMEOUT_MS = 1500;
const INSTALL_POLL_MS = 2000;
const INSTALL_POLL_MAX = 45;
const RETRY_PROBE_MS = 12000;
/** Client-only stats refresh; avoid sub-minute polling + full RSC refresh (keeps dashboard responsive). */
const STATS_POLL_MS = 5 * 60 * 1000;
const TOKEN_PUSH_INTERVAL_MS = 60 * 1000;

/** sessionStorage: one seed-tab burst per browser tab session per Supabase access token (until tab closes). */
const SEED_DONE_STORAGE_KEY = 'rg_merchant_seed_done_fp';

function tokenFingerprint(token: string): string {
  let h = 0;
  for (let i = 0; i < token.length; i++) h = (Math.imul(31, h) + token.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Resolves on next successful `REFYNDRA_TOKEN_ACK` (listener registered before push). */
function waitForTokenAckOnce(timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMsg);
      reject(new Error('token_ack_timeout'));
    }, timeoutMs);

    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { type?: string; ok?: boolean; error?: string };
      if (d?.type !== 'REFYNDRA_TOKEN_ACK') return;
      window.clearTimeout(timer);
      window.removeEventListener('message', onMsg);
      if (d.ok) resolve();
      else reject(new Error(d.error || 'token_ack_failed'));
    }

    window.addEventListener('message', onMsg);
  });
}

function randomId() {
  try {
    return crypto.randomUUID();
  } catch {
    return String(Date.now()) + Math.random().toString(36).slice(2);
  }
}

export function probeExtension(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    const requestId = randomId();
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMsg);
      resolve(false);
    }, PROBE_TIMEOUT_MS);

    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { type?: string; requestId?: string; ok?: boolean };
      if (d?.type === 'RG_EXTENSION_ACK' && d.requestId === requestId && d.ok) {
        window.clearTimeout(timer);
        window.removeEventListener('message', onMsg);
        resolve(true);
      }
    }

    window.addEventListener('message', onMsg);
    window.postMessage({ type: 'RG_EXTENSION_PROBE', requestId }, window.location.origin);
  });
}

async function getSessionWithRetries(supabase: ReturnType<typeof createClient>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    if (t) return t;
    await sleep(300 * Math.pow(2, attempt));
  }
  return null;
}

async function pushTokenToExtension(token: string) {
  if (typeof window === 'undefined') return;
  const apiBase = window.location.origin;
  for (let i = 0; i < TOKEN_PUSH_DELAYS_MS.length; i++) {
    if (TOKEN_PUSH_DELAYS_MS[i]) await sleep(TOKEN_PUSH_DELAYS_MS[i]);
    window.postMessage(
      { type: 'REFYNDRA_CONNECT_TOKEN', token, apiBase },
      window.location.origin
    );
  }
}

/**
 * Merchant tabs: **`chrome.tabs.create({ active: false })`** from the extension so the Dashboard keeps focus.
 * On button click we **synchronously** `postMessage` the content script (same turn as the click) so the
 * chain starts without `await` first. After token ACK we optionally skip a second open when the click-time
 * burst already ran (`suppressPostAckMerchantOpen`). Install auto-detect uses post-ACK open only.
 */
type SeedOpenResult = {
  key: (typeof MERCHANT_SEED_URLS)[number]['key'];
  opened: boolean;
  newTab: boolean;
};

function merchantSeedEntriesForBridge() {
  return MERCHANT_SEED_URLS.map((x) => ({ key: x.key, url: x.url, label: x.label }));
}

/** First line of the connect/reseed button — no await before this. */
function fireInactiveMerchantSeedFromClick(): void {
  if (typeof window === 'undefined') return;
  window.postMessage(
    {
      type: 'REFYNDRA_OPEN_MERCHANT_SEED',
      requestId: randomId(),
      inactive: true,
      entries: merchantSeedEntriesForBridge(),
    },
    window.location.origin
  );
}

function logSeedRowsFromExtensionResults(
  results: { key?: string; ok?: boolean; error?: string }[] | undefined
): SeedOpenResult[] {
  const byKey = new Map<string, { ok: boolean; error?: string }>();
  for (const r of results ?? []) {
    if (typeof r.key === 'string' && r.key) {
      byKey.set(r.key, { ok: !!r.ok, error: r.error });
    }
  }
  return MERCHANT_SEED_URLS.map((item) => {
    const hit = byKey.get(item.key);
    const opened = hit?.ok === true;
    if (!opened) {
      console.warn(
        `[Refyndra] Merchant seed: ${item.key} · ${item.label} — FAIL${hit?.error ? ` (${hit.error})` : ''}`
      );
    }
    return { key: item.key, opened, newTab: opened };
  });
}

function openMerchantSeedsViaExtensionAwaitable(): Promise<SeedOpenResult[]> {
  if (typeof window === 'undefined') {
    return Promise.resolve(
      MERCHANT_SEED_URLS.map((item) => ({ key: item.key, opened: false, newTab: false }))
    );
  }
  return new Promise((resolve) => {
    const requestId = randomId();
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onDone);
      console.warn('[Refyndra] Merchant seed: extension open timed out');
      resolve(
        MERCHANT_SEED_URLS.map((item) => {
          console.warn(`[Refyndra] Merchant seed: ${item.key} · ${item.label} — FAIL (timeout)`);
          return { key: item.key, opened: false, newTab: false };
        })
      );
    }, 12000);
    function onDone(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const d = e.data as {
        type?: string;
        requestId?: string;
        ok?: boolean;
        opened?: number;
        results?: { key?: string; ok?: boolean; error?: string }[];
      };
      if (d?.type !== 'REFYNDRA_OPEN_MERCHANT_SEED_DONE' || d.requestId !== requestId) return;
      window.clearTimeout(timer);
      window.removeEventListener('message', onDone);

      const n = MERCHANT_SEED_URLS.length;
      if ((!d.results || d.results.length === 0) && (d.opened ?? 0) >= n) {
        const allOk = MERCHANT_SEED_URLS.map((item) => ({
          key: item.key,
          opened: true,
          newTab: true,
        }));
        resolve(allOk);
        return;
      }

      resolve(logSeedRowsFromExtensionResults(d.results));
    }
    window.addEventListener('message', onDone);
    window.postMessage(
      {
        type: 'REFYNDRA_OPEN_MERCHANT_SEED',
        requestId,
        inactive: true,
        entries: merchantSeedEntriesForBridge(),
      },
      window.location.origin
    );
  });
}

async function openMerchantSeedsWithExtensionRetry(): Promise<SeedOpenResult[]> {
  let rows = await openMerchantSeedsViaExtensionAwaitable();
  if (rows.every((r) => r.opened)) return rows;
  console.warn('[Refyndra] Merchant seed: second pass (retry chrome.tabs.create for failures)');
  const second = await openMerchantSeedsViaExtensionAwaitable();
  const m = new Map(second.map((r) => [r.key, r]));
  return rows.map((r) => {
    const s = m.get(r.key);
    const opened = r.opened || !!s?.opened;
    return { key: r.key, opened, newTab: opened };
  });
}

function Spinner() {
  return (
    <svg
      className="inline h-3.5 w-3.5 animate-spin text-[var(--muted)]"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export type ExtensionTokenVariant = 'compact' | 'dashboard';

export function ExtensionToken({ variant = 'compact' }: { variant?: ExtensionTokenVariant } = {}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [extensionOk, setExtensionOk] = useState<boolean | null>(null);
  const [tokenOk, setTokenOk] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [seedOpened, setSeedOpened] = useState(false);
  const [banner, setBanner] = useState<string>('');
  const [waitingInstall, setWaitingInstall] = useState(false);
  const [stats, setStats] = useState<UsPlatformStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const lastPushedRef = useRef<string | null>(null);
  const installPollCount = useRef(0);
  const pendingOpenSeedAfterDetectRef = useRef(false);
  /** Prevents overlapping seed bursts (double-click + install poll) — avoids duplicate Amazon tabs. */
  const seedBurstInFlightRef = useRef(false);
  const [seedBurstBusy, setSeedBurstBusy] = useState(false);
  type ActivityEntry = { id: string; t: string; message: string };
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const bannerTimerRef = useRef<number | null>(null);
  const bannerResetTimerRef = useRef<number | null>(null);
  /**
   * Hard-stop banner spam:
   * - Each button click increments an action token.
   * - We allow at most ONE banner per action token (first one wins).
   * This prevents repeated banners even when retries/polling fire many messages.
   */
  const bannerActionTokenRef = useRef<number>(0);
  const bannerShownTokenRef = useRef<number>(0);
  const [lastSeedSummary, setLastSeedSummary] = useState<
    | { at: string; opened: number; total: number; failedKeys: string[] }
    | null
  >(null);

  const BANNER_SESSION_KEY = 'rg_banner_once_per_click_v1';

  useEffect(() => {
    // Persist banner gating across remounts / refresh loops.
    try {
      const raw = sessionStorage.getItem(BANNER_SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { actionToken?: number; shownToken?: number; until?: number };
      if (typeof parsed.until === 'number' && Date.now() > parsed.until) return;
      if (typeof parsed.actionToken === 'number') bannerActionTokenRef.current = parsed.actionToken;
      if (typeof parsed.shownToken === 'number') bannerShownTokenRef.current = parsed.shownToken;
    } catch {
      /* ignore */
    }
  }, []);

  const appendActivity = useCallback((message: string) => {
    setActivityLog((prev) => {
      const row: ActivityEntry = {
        id: randomId(),
        t: new Date().toLocaleTimeString(undefined, { timeStyle: 'medium' }),
        message,
      };
      return [row, ...prev].slice(0, 16);
    });
  }, []);

  /** Real-time status lines after a successful Connect & Start Scanning (debounced cadence). */
  const logInstallSyncSuccessSequence = useCallback(() => {
    appendActivity('Scanning receipts…');
    window.setTimeout(() => appendActivity('Checking delivery times…'), 600);
    window.setTimeout(() => appendActivity('Compensation calculated automatically…'), 1200);
    window.setTimeout(() => appendActivity('Compensation recorded.'), 2000);
  }, [appendActivity]);

  const showBanner = useCallback((msg: string, ms = 4000) => {
    const token = bannerActionTokenRef.current;
    // Only one banner per user action (first message wins).
    if (token === 0) return;
    if (bannerShownTokenRef.current === token) return;
    bannerShownTokenRef.current = token;
    setBanner(msg);
    try {
      sessionStorage.setItem(
        BANNER_SESSION_KEY,
        JSON.stringify({
          actionToken: bannerActionTokenRef.current,
          shownToken: bannerShownTokenRef.current,
          until: Date.now() + 60_000,
        })
      );
    } catch {
      /* ignore */
    }
    if (bannerTimerRef.current != null) {
      window.clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    bannerTimerRef.current = window.setTimeout(() => {
      bannerTimerRef.current = null;
      setBanner('');
    }, ms);
  }, []);

  const pushIfNew = useCallback(
    async (accessToken: string, opts?: { force?: boolean }) => {
      if (!opts?.force && accessToken === lastPushedRef.current) return;
      lastPushedRef.current = accessToken;
      await pushTokenToExtension(accessToken);
    },
    []
  );

  const runConnect = useCallback(
    async (opts?: {
      force?: boolean;
      openSeed?: boolean;
      forceReseed?: boolean;
      /** When true, skip post-ACK `chrome.tabs.create` (click already fired inactive seed burst). */
      suppressPostAckMerchantOpen?: boolean;
    }) => {
      const ok = await probeExtension();
      setExtensionOk(ok);
      if (!ok) {
        showBanner(
          'Install Refyndra from the Chrome Web Store, then come back here and tap Connect & Start Scanning.'
        );
        return false;
      }

      const supabase = createClient();
      const t = await getSessionWithRetries(supabase);
      if (!t) {
        showBanner('No session. Sign in again.');
        return false;
      }

      const forcePush = opts?.force === true || opts?.openSeed === true;

      if (opts?.openSeed) {
        if (seedBurstInFlightRef.current) {
          showBanner(
            'Merchant pages are already opening — wait a few seconds. Avoid double-clicking the button.',
            6500
          );
          return true;
        }
        seedBurstInFlightRef.current = true;
        setSeedBurstBusy(true);
        const releaseBurst = () => {
          seedBurstInFlightRef.current = false;
          setSeedBurstBusy(false);
        };

        try {
          const ackPromise = waitForTokenAckOnce(8000);
          await pushIfNew(t, { force: forcePush });
          try {
            await ackPromise;
          } catch {
            showBanner(
              `Session sync timed out. This usually means the extension dashboard bridge is not running on this domain (${window.location.hostname}). Reload the extension, then hard-refresh this page.`,
              9000
            );
            releaseBurst();
            return false;
          }
          const fp = tokenFingerprint(t);
          if (!opts.forceReseed && sessionStorage.getItem(SEED_DONE_STORAGE_KEY) === fp) {
            setSeedOpened(true);
            releaseBurst();
            return true;
          }
          let rows: SeedOpenResult[];
          if (opts.suppressPostAckMerchantOpen) {
            rows = MERCHANT_SEED_URLS.map((item) => ({
              key: item.key,
              opened: true,
              newTab: true,
            }));
          } else {
            rows = await openMerchantSeedsWithExtensionRetry();
          }
          try {
            const anyFailed = rows.some((r) => !r.opened);
            const openedCount = rows.filter((r) => r.opened).length;
            const failedKeys = rows.filter((r) => !r.opened).map((r) => r.key);
            setLastSeedSummary({
              at: new Date().toISOString(),
              opened: openedCount,
              total: rows.length,
              failedKeys,
            });
            if (openedCount === 0) {
              showBanner(
                'No merchant tabs were opened. Reload the extension (chrome://extensions → Reload), hard-refresh this page, then try again.',
                11000
              );
            } else if (anyFailed) {
              const failedKeysStr = failedKeys.join(', ');
              showBanner(
                `Some merchant tabs did not open (${failedKeysStr}). Try Reload on the extension and run again.`,
                11000
              );
            } else {
              showBanner(
                `Opened ${openedCount}/${rows.length} merchant tabs in the background.`,
                5000
              );
            }
            const anyOk = rows.some((r) => r.opened);
            if (anyOk) {
              sessionStorage.setItem(SEED_DONE_STORAGE_KEY, fp);
              setSeedOpened(true);
            }
          } finally {
            releaseBurst();
          }
          // Don’t claim success if every merchant tab failed (was returning true here before).
          return rows.some((r) => r.opened);
        } catch (e) {
          console.error('[Refyndra] Connect + seed failed', e);
          releaseBurst();
          showBanner('Could not sync or open merchant pages. Try again in a moment.', 6000);
          return false;
        }
      }

      await pushIfNew(t, { force: forcePush });
      return true;
    },
    [pushIfNew, showBanner]
  );

  const refreshStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const s = await fetchUsPlatformStats();
      setStats(s);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    const onAck = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { type?: string; ok?: boolean; at?: string; error?: string };
      if (d?.type !== 'REFYNDRA_TOKEN_ACK') return;
      if (d.ok) {
        setTokenOk(true);
        const at = typeof d.at === 'string' ? d.at : new Date().toISOString();
        setLastSyncAt(at);
      } else {
        setTokenOk(false);
        showBanner(d.error || 'Token sync failed.');
      }
    };
    window.addEventListener('message', onAck);
    return () => window.removeEventListener('message', onAck);
  }, [showBanner]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await probeExtension();
      if (!cancelled) setExtensionOk(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Restore “order pages opened once” after refresh (same tab session + same token fingerprint). */
  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token;
      if (!t) return;
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SEED_DONE_STORAGE_KEY) === tokenFingerprint(t)) {
        setSeedOpened(true);
      }
    })();
  }, []);

  useEffect(() => {
    void refreshStats();
    const id = window.setInterval(() => {
      void refreshStats();
    }, STATS_POLL_MS);
    return () => window.clearInterval(id);
  }, [refreshStats]);

  useEffect(() => {
    if (extensionOk !== false) return;
    const id = window.setInterval(() => {
      void (async () => {
        const ok = await probeExtension();
        if (ok) {
          setExtensionOk(true);
          const supabase = createClient();
          const t = await getSessionWithRetries(supabase);
          if (t) {
            lastPushedRef.current = null;
            await pushIfNew(t, { force: true });
          }
        }
      })();
    }, RETRY_PROBE_MS);
    return () => window.clearInterval(id);
  }, [extensionOk, pushIfNew]);

  useEffect(() => {
    if (extensionOk !== true) return;
    const supabase = createClient();
    let cancelled = false;

    const tick = async () => {
      const t = await getSessionWithRetries(supabase);
      if (cancelled || !t) return;
      await pushIfNew(t);
    };

    void tick();
    const interval = window.setInterval(tick, TOKEN_PUSH_INTERVAL_MS);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      const t = session?.access_token;
      if (t) {
        lastPushedRef.current = null;
        void pushIfNew(t, { force: true });
      }
    });

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [extensionOk, pushIfNew]);

  useEffect(() => {
    if (!waitingInstall) {
      installPollCount.current = 0;
      return;
    }
    const id = window.setInterval(() => {
      installPollCount.current += 1;
      if (installPollCount.current > INSTALL_POLL_MAX) {
        setWaitingInstall(false);
        showBanner('Still waiting for the extension. Install it, return here, then tap Connect & Start Scanning again.');
        return;
      }
      void (async () => {
        const ok = await probeExtension();
        if (ok) {
          setWaitingInstall(false);
          setExtensionOk(true);
          const openSeed = pendingOpenSeedAfterDetectRef.current;
          pendingOpenSeedAfterDetectRef.current = false;
          await runConnect({ force: true, openSeed });
          showBanner(
            openSeed
              ? 'Connected. Syncing your session and opening your order pages…'
              : 'Extension detected.'
          );
        }
      })();
    }, INSTALL_POLL_MS);
    return () => window.clearInterval(id);
  }, [waitingInstall, runConnect, showBanner, logInstallSyncSuccessSequence]);

  const onReseedOrderPages = useCallback(
    async (opts?: { suppressPostAckMerchantOpen?: boolean }) => {
      await runConnect({
        force: true,
        openSeed: true,
        forceReseed: true,
        suppressPostAckMerchantOpen: opts?.suppressPostAckMerchantOpen,
      });
      // Result banners come from runConnect (opened count / errors) — no duplicate message here.
    },
    [runConnect]
  );

  const onInstallAndSync = (opts?: { suppressPostAckMerchantOpen?: boolean }) => {
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    void (async () => {
      await sleep(350);
      const already = await probeExtension();
      setExtensionOk(already);
      if (already) {
        setWaitingInstall(false);
        pendingOpenSeedAfterDetectRef.current = false;
        const ok = await runConnect({
          force: true,
          openSeed: true,
          suppressPostAckMerchantOpen: opts?.suppressPostAckMerchantOpen,
        });
        if (ok) {
          logInstallSyncSuccessSequence();
        }
        showBanner('You’re connected. Merchant pages open in background tabs…', 5000);
        return;
      }
      pendingOpenSeedAfterDetectRef.current = true;
      const storeUrl = getChromeWebStoreUrl();
      if (storeUrl) {
        window.open(storeUrl, '_blank', 'noopener,noreferrer');
      } else {
        window.open('https://chromewebstore.google.com/category/extensions', '_blank', 'noopener,noreferrer');
        showBanner('Set NEXT_PUBLIC_CHROME_WEB_STORE_URL for a direct listing link.', 8000);
      }
      setWaitingInstall(true);
    })();
  };

  const fullyConnected = extensionOk === true && tokenOk === true;
  const needsInstall = extensionOk === false;

  /** Only disable while probing extension or waiting for store install — never hide the primary CTA after connected. */
  const primaryActionDisabled = extensionOk === null || waitingInstall || seedBurstBusy;

  const shellClass =
    variant === 'dashboard'
      ? 'w-full max-w-none rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3 shadow-lg shadow-black/20 sm:p-5'
      : 'max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3';

  return (
    <div ref={cardRef} className={shellClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-semibold text-zinc-200 sm:text-xs sm:font-medium sm:text-[var(--muted)]" title="US storefronts: Amazon, Uber, Uber Eats, DoorDash">
          One-click setup
        </p>
        <span
          className="flex items-center gap-1.5 text-sm font-medium text-zinc-300 sm:text-[10px] sm:font-normal sm:text-zinc-500"
          title="Stats refresh about every 5 minutes while this tab is open"
        >
          {statsLoading ? <Spinner /> : null}
          <span aria-live="polite">
            {stats?.fetchedAt
              ? `Updated ${new Date(stats.fetchedAt).toLocaleTimeString(undefined, { timeStyle: 'short' })}`
              : 'Loading stats…'}
          </span>
        </span>
      </div>

      <div className="space-y-1 text-base leading-relaxed text-zinc-200 sm:text-xs sm:text-[var(--muted)]">
        <p>One-click connects your stores.</p>
        <p>
          Keep this tab open in the background so Refyndra can monitor your orders and catch refunds automatically.
        </p>
      </div>

      {banner ? (
        <p className="text-base font-semibold text-amber-100 sm:text-xs sm:font-medium sm:text-amber-200" role="status">
          {banner}
        </p>
      ) : null}

      {waitingInstall ? (
        <p className="text-base text-zinc-100 sm:text-xs sm:text-[var(--foreground)]" aria-live="polite">
          Waiting for the extension… install from the store, then return here.
        </p>
      ) : null}

      <div
        className="rounded-lg border border-[var(--border)] bg-[var(--background)]/50 px-3 py-2.5 text-base leading-relaxed text-zinc-100 sm:text-[11px] sm:text-zinc-300"
        title="Three steps: install extension → connect session → background sync"
      >
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-300 sm:text-[10px] sm:text-zinc-500">Current status</p>
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-zinc-500">Extension:</span>
            {extensionOk === null ? (
              <span className="text-zinc-400">Checking…</span>
            ) : extensionOk ? (
              <span className="font-medium text-emerald-300">✅ Installed</span>
            ) : (
              <span className="font-medium text-rose-300">❌ Not installed</span>
            )}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-zinc-500">Token:</span>
            {tokenOk ? (
              <span className="font-medium text-emerald-300">✅ Connected</span>
            ) : extensionOk === true ? (
              <span className="font-medium text-amber-200/95">❌ Not connected</span>
            ) : (
              <span className="text-zinc-500">— (install extension first)</span>
            )}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm font-medium text-zinc-300 sm:text-[10px] sm:font-normal sm:text-zinc-500">
            <span>Last sync:</span>
            <span>
              {lastSyncAt
                ? new Date(lastSyncAt).toLocaleString(undefined, {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  })
                : '—'}
            </span>
            <span className="text-zinc-600">·</span>
            <span>Order pages:</span>
            <span>{seedOpened ? 'opened once' : 'not opened yet'}</span>
            {lastSeedSummary ? (
              <>
                <span className="text-zinc-600">·</span>
                <span title="Last seed-tab attempt result">
                  seed: {lastSeedSummary.opened}/{lastSeedSummary.total}
                  {lastSeedSummary.failedKeys.length > 0
                    ? ` (failed: ${lastSeedSummary.failedKeys.join(', ')})`
                    : ''}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {fullyConnected ? (
        <p className="text-center text-base font-semibold text-emerald-200 sm:text-[11px] sm:font-medium sm:text-emerald-300">✓ Connected · Auto-running</p>
      ) : null}

      <button
        type="button"
        onClick={() => {
          bannerActionTokenRef.current += 1;
          bannerShownTokenRef.current = 0;
          try {
            sessionStorage.setItem(
              BANNER_SESSION_KEY,
              JSON.stringify({
                actionToken: bannerActionTokenRef.current,
                shownToken: bannerShownTokenRef.current,
                until: Date.now() + 60_000,
              })
            );
          } catch {
            /* ignore */
          }
          // After the click-triggered flow settles, disable banners again so background polling can’t resurface them.
          if (bannerResetTimerRef.current != null) window.clearTimeout(bannerResetTimerRef.current);
          bannerResetTimerRef.current = window.setTimeout(() => {
            bannerResetTimerRef.current = null;
            bannerActionTokenRef.current = 0;
            try {
              sessionStorage.removeItem(BANNER_SESSION_KEY);
            } catch {
              /* ignore */
            }
          }, 12_000);
          // Never suppress real `chrome.tabs.create` here: `suppressPostAckMerchantOpen: true` was skipping
          // inactive merchant tabs whenever the extension was already installed but the token was not yet ACK’d,
          // which made the UI claim tabs opened when they did not.
          if (fullyConnected) void onReseedOrderPages({ suppressPostAckMerchantOpen: false });
          else void onInstallAndSync({ suppressPostAckMerchantOpen: false });
        }}
        disabled={primaryActionDisabled}
        className={`min-h-[52px] w-full touch-manipulation rounded-lg px-4 py-3 text-base font-bold shadow-sm transition focus:outline-none focus-visible:ring-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 sm:min-h-[44px] sm:py-2.5 sm:text-sm sm:font-semibold ${
          fullyConnected
            ? 'border border-emerald-500/45 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25 focus-visible:ring-emerald-400/50'
            : needsInstall
              ? 'border border-rose-500/40 bg-rose-500/15 text-rose-50 hover:bg-rose-500/25 focus-visible:ring-rose-400/50'
              : 'bg-[var(--accent)] text-[var(--background)] hover:bg-[var(--accent-muted)] focus-visible:ring-emerald-300'
        }`}
        title={
          seedBurstBusy
            ? 'Opening merchant order pages — please wait.'
            : fullyConnected
              ? 'Open Amazon, Uber Eats, Uber Rides & DoorDash order pages again in new tabs (seed).'
              : needsInstall
                ? 'Opens the Chrome Web Store to add Refyndra (Add to Chrome), then return here — we detect the extension automatically.'
                : 'Connect your Refyndra session and open your order pages once so we can sync.'
        }
      >
        {extensionOk === null
          ? 'Checking…'
          : waitingInstall
            ? 'Waiting for extension…'
            : seedBurstBusy
              ? 'Opening order pages…'
              : fullyConnected
                ? 'Open order pages again (seed tabs)'
                : needsInstall
                  ? 'Install Extension & Start'
                  : 'Connect & Start Scanning'}
      </button>
      <p className="text-center text-sm leading-snug text-zinc-300 sm:text-[10px] sm:text-zinc-500">
        {fullyConnected
          ? 'Keep this Dashboard tab open for background sync (token + stats). Use the button above to re-open merchant order tabs when needed.'
          : 'Takes less than 60 seconds. One-time setup.'}
      </p>

      {activityLog.length > 0 ? (
        <div
          className="rounded-lg border border-[var(--border)] bg-[var(--background)]/50 px-3 py-2"
          title="Activity log for the last Connect & Start Scanning run"
          aria-live="polite"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-300 sm:text-[10px] sm:text-zinc-500">Activity</p>
          <ul className="max-h-36 space-y-1.5 overflow-y-auto text-sm text-zinc-200 sm:text-[11px] sm:text-zinc-300">
            {activityLog.map((row) => (
              <li key={row.id} className="flex gap-2">
                <span className="shrink-0 tabular-nums text-zinc-500">{row.t}</span>
                <span>{row.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-1">
        <p
          className="text-xs font-semibold uppercase tracking-wider text-zinc-300 sm:text-[10px] sm:text-zinc-500"
          title="Orders scanned and compensation recovered from your account (refreshes about every 5 min while this tab is open)"
        >
          Per platform
        </p>
        {stats?.ordersUnavailable === 'missing_table' ? (
          <div className="space-y-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-base leading-relaxed text-amber-50 sm:text-[11px] sm:text-amber-100/95">
            <p>
              Order totals will show once your account setup is finished. Refresh this page after your administrator
              completes setup, or contact Refyndra support.
            </p>
            <p className="border-t border-amber-500/20 pt-2 text-amber-100/90" dir="rtl" lang="ar">
              ستظهر أرقام الطلبات بعد اكتمال إعداد الحساب. حدّث الصفحة لاحقاً أو تواصل مع الدعم إذا استمرت المشكلة.
            </p>
          </div>
        ) : null}
        <div
          className={
            variant === 'dashboard' ? 'grid gap-2 sm:grid-cols-2 sm:items-stretch' : 'space-y-1'
          }
        >
          {US_PLATFORMS.map((p) => {
            const orders = stats?.orderCounts[p.id] ?? 0;
            const cents = stats?.compensationCents[p.id] ?? 0;
            return (
              <details
                key={p.id}
                className="group flex min-h-[4.5rem] flex-col rounded-lg border border-[var(--border)] bg-[var(--background)]/40 px-3 py-2.5"
                title={`${p.label}: US-only orders synced to Refyndra`}
              >
                <summary className="cursor-pointer list-none text-base font-semibold text-zinc-50 marker:content-none [&::-webkit-details-marker]:hidden sm:text-xs sm:font-medium sm:text-[var(--foreground)]">
                  <span className="grid w-full grid-cols-1 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3">
                    <span className="min-w-0">{p.label}</span>
                    <span
                      className="text-sm font-medium tabular-nums text-zinc-200 sm:text-right sm:text-[10px] sm:font-normal"
                      title="Orders scanned · compensation recovered"
                    >
                      <span className="text-zinc-400">{orders} orders</span>
                      <span className="text-zinc-600"> · </span>
                      <span className="font-medium text-emerald-400">{formatCents(cents)}</span>
                      <span className="text-zinc-500"> recovered</span>
                    </span>
                  </span>
                </summary>
                <div className="mt-2 space-y-1 border-t border-[var(--border)] pt-2 text-base text-zinc-200 sm:text-[11px] sm:text-zinc-400">
                  <p>
                    <span className="text-zinc-500">Orders tracked:</span> {orders}
                  </p>
                  <p>
                    <span className="text-zinc-500">Money back so far:</span>{' '}
                    <span className="font-medium tabular-nums text-emerald-400">{formatCents(cents)}</span>
                  </p>
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </div>
  );
}
