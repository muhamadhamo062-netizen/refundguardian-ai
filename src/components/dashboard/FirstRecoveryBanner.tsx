'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatUsdFromCents, US_COPY } from '@/lib/usCopy/compensation';

const storageKey = (userId: string) => `rg_first_recovery_banner_dismissed_${userId}`;

type Props = {
  userId: string;
  /** Total cents from refund_history */
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
          <p className="text-sm font-semibold text-emerald-100">{US_COPY.firstRecoveryTitle}</p>
          <p className="text-sm leading-relaxed text-zinc-200">{body}</p>
          <p className="text-[11px] leading-snug text-zinc-500">{US_COPY.disclaimerShort}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          {!isPro ? (
            <Link
              href="/upgrade"
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              {US_COPY.ctaUpgrade}
            </Link>
          ) : (
            <Link
              href="/dashboard/refund-history"
              className="inline-flex items-center justify-center rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            >
              {US_COPY.ctaViewHistory}
            </Link>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="text-[11px] font-medium text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
          >
            {US_COPY.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}
