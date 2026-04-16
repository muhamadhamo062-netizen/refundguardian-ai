'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { inferIssueTypeFromRow, inferPlatformFromProvider } from '@/lib/refundPriorityEngine';
import { DASHBOARD_AI_SCAN_ORDER_LIMIT } from '@/lib/dashboard/scanOrderLimit';

function parsePriceToAmount(price: string): number | null {
  if (!price || price === '—') return null;
  const s = String(price).replace(/,/g, '');
  const m = s.match(/([\d.]+)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isNaN(n) ? null : n;
}

type OrderApiRow = {
  id: string;
  orderId: string;
  productName: string;
  price: string;
  date: string;
  provider?: string;
};

/**
 * Runs AI value analysis on synced orders (same pipeline as the orders table refresh).
 * Uses the most recent N orders from GET /api/orders — not a fixed calendar window.
 */
export function ScanButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/orders?limit=${DASHBOARD_AI_SCAN_ORDER_LIMIT}`, { cache: 'no-store' });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        orders?: OrderApiRow[];
        error?: string;
      };

      if (!res.ok || body.ok !== true || !Array.isArray(body.orders)) {
        setError(typeof body.error === 'string' ? body.error : 'Could not load orders.');
        return;
      }

      const rows = body.orders.filter(
        (r) => r.orderId && !String(r.orderId).startsWith('rg-seed-')
      );

      if (rows.length === 0) {
        setError('No orders to analyze yet. Connect Gmail and run a scan first.');
        return;
      }

      const orders = rows.map((r) => ({
        id: r.id,
        order_id: r.orderId,
        platform: inferPlatformFromProvider(r.provider),
        issue_type: inferIssueTypeFromRow({
          productName: r.productName,
          provider: r.provider,
        }),
        amount: parsePriceToAmount(r.price),
        order_date: r.date,
        product_name: r.productName,
      }));

      const aiRes = await fetch('/api/refund-decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orders }),
      });

      const aiBody = (await aiRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        decisions?: unknown[];
      };

      if (!aiRes.ok || aiBody.ok !== true) {
        setError(typeof aiBody.error === 'string' ? aiBody.error : 'AI scan failed.');
        return;
      }

      const n = Array.isArray(aiBody.decisions) ? aiBody.decisions.length : 0;
      setMessage(`Analyzed ${n} order${n === 1 ? '' : 's'}.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end"
      aria-busy={loading}
    >
      <button
        type="button"
        onClick={() => void handleScan()}
        disabled={loading}
        title={`Analyzes up to ${DASHBOARD_AI_SCAN_ORDER_LIMIT} most recently synced orders (not a strict 30-day calendar filter).`}
        aria-label={
          loading
            ? 'AI scan in progress, please wait'
            : `Run AI analysis on up to ${DASHBOARD_AI_SCAN_ORDER_LIMIT} synced orders`
        }
        className={`group relative inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center overflow-hidden rounded-xl px-5 py-3 text-sm font-semibold transition-colors sm:w-auto sm:min-h-[44px] sm:px-6 ${
          loading
            ? 'cursor-wait bg-[var(--accent-muted)] text-[var(--background)] animate-rg-scan-ring'
            : 'bg-[var(--accent)] text-[var(--background)] hover:bg-[var(--accent-muted)] disabled:cursor-not-allowed disabled:opacity-60'
        }`}
      >
        {loading ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 w-[70%] animate-rg-scan-shimmer bg-gradient-to-r from-transparent via-white/45 to-transparent opacity-90"
          />
        ) : null}
        <span className="relative z-10 flex items-center justify-center gap-2.5">
          {loading ? (
            <>
              <svg
                className="h-5 w-5 shrink-0 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-95"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="font-semibold tracking-tight">Scanning orders…</span>
              <span className="hidden items-center gap-0.5 sm:inline-flex" aria-hidden>
                <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
                <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
                <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-current" />
              </span>
            </>
          ) : (
            <span>{`Run AI scan (up to ${DASHBOARD_AI_SCAN_ORDER_LIMIT} orders)`}</span>
          )}
        </span>
      </button>

      {loading ? (
        <div
          className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-2.5 sm:hidden"
          role="status"
          aria-live="polite"
        >
          <p className="text-center text-[11px] font-medium leading-snug text-emerald-100/95">
            Analyzing your synced orders — looking for refund opportunities.
          </p>
          <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-bounce" />
          </div>
          <p className="mt-1.5 text-center text-[10px] text-emerald-200/60">
            Background email &amp; sync jobs keep adding data — this scan uses your latest orders.
          </p>
        </div>
      ) : null}

      {message ? (
        <p className="max-w-full text-center text-xs text-emerald-400/90 sm:max-w-xs sm:text-right">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="max-w-full text-center text-xs text-red-400 sm:max-w-xs sm:text-right">{error}</p>
      ) : null}
    </div>
  );
}
