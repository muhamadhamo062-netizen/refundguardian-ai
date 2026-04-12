'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatUsdFromCents, US_COPY } from '@/lib/usCopy/compensation';

const storageKey = (userId: string) => `rg_first_recovery_banner_dismissed_${userId}`;

type Props = {
  userId: string;
  /** Total recovered (USD, passed from the server for display). */
  totalCents: number;
  refundCount: number;
  isPro: boolean;
};

/**
 * US English celebration + soft upgrade CTA when we have recorded compensation.
 * Shown until dismissed (per user, localStorage).
 */
export function FirstRecoveryBanner({ userId, totalCents, refundCount, isPro }: Props) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !userId) return;
    try {
      setDismissed(window.localStorage.getItem(storageKey(userId)) === '1');
    } catch {
      setDismissed(false);
    }
    setMounted(true);
  }, [userId]);

  const onDismiss = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey(userId), '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, [userId]);

  if (!mounted || totalCents <= 0 || refundCount < 1 || dismissed) return null;

  const total = formatUsdFromCents(totalCents);
  const body =
    refundCount === 1
      ? US_COPY.firstRecoveryBodyOne(total)
      : US_COPY.firstRecoveryBodyMany(total, refundCount);

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-emerald-500/35 bg-gradient-to-br from-emerald-950/80 via-[var(--card)] to-[var(--background)] px-4 py-4 shadow-lg shadow-emerald-900/20 sm:px-5"
      role="region"
      aria-label="Compensation recorded"
    >
      <div className="absolute inset-y-0 right-0 w-32 bg-[radial-gradient(circle_at_100%_50%,rgba(52,211,153,0.12),transparent)] pointer-events-none" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-base font-semibold text-emerald-50 sm:text-sm sm:text-emerald-100">{US_COPY.firstRecoveryTitle}</p>
          <p className="text-base leading-relaxed text-zinc-100 sm:text-sm sm:text-zinc-200">{body}</p>
          <p className="text-base leading-snug text-zinc-300 sm:text-[11px] sm:text-zinc-500">{US_COPY.disclaimerShort}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          {!isPro ? (
            <Link
              href="/upgrade"
              className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-emerald-500 px-4 py-3 text-base font-bold text-emerald-950 transition hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 sm:min-h-0 sm:py-2 sm:text-sm sm:font-semibold"
            >
              {US_COPY.ctaUpgrade}
            </Link>
          ) : (
            <Link
              href="/dashboard/refund-history"
              className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-base font-bold text-emerald-50 transition hover:bg-emerald-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 sm:min-h-0 sm:py-2 sm:text-sm sm:font-semibold sm:text-emerald-100"
            >
              {US_COPY.ctaViewHistory}
            </Link>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="text-base font-semibold text-zinc-300 underline-offset-2 hover:text-zinc-200 hover:underline sm:text-[11px] sm:font-medium sm:text-zinc-500"
          >
            {US_COPY.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}
