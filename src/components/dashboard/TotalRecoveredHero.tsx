'use client';

import { AnimatedCounter } from '@/components/dashboard/AnimatedCounter';

type Props = {
  totalDollars: number;
  subtitle?: string;
};

/** Prominent total-recovered KPI — emerald styling. */
export function TotalRecoveredHero({
  totalDollars,
  subtitle = 'Real-time monitoring of your savings.',
}: Props) {
  const decimals = 2;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/40 via-[var(--card)] to-[#0a0c10] p-6 shadow-2xl shadow-black/30 sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.12),transparent)]" />
      <div className="relative">
        <p className="!text-base !font-bold uppercase tracking-[0.2em] text-emerald-200 sm:!text-[10px] sm:font-semibold sm:text-emerald-200/70 md:text-sm">
          Total recovered
        </p>
        <p className="mt-2 text-6xl font-extrabold tabular-nums leading-[0.95] tracking-tight text-emerald-400 drop-shadow-[0_0_28px_rgba(52,211,153,0.35)] md:text-5xl lg:text-6xl xl:text-7xl">
          <AnimatedCounter value={totalDollars} prefix="$" decimals={decimals} duration={1400} />
        </p>
        <p className="mt-3 !text-base !font-semibold text-zinc-200 sm:text-xs sm:!font-normal sm:text-zinc-500 md:text-sm">{subtitle}</p>
        {totalDollars <= 0 ? (
          <p className="mt-1.5 !text-base !font-medium text-zinc-200 sm:text-[11px] sm:!font-normal sm:text-zinc-500/80">Waiting for your first scan...</p>
        ) : null}
      </div>
    </div>
  );
}
