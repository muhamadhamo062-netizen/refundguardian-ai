import Link from 'next/link';

type Props = {
  amountDollars: number;
};

/**
 * Free tier: tease a detected opportunity to drive Pro upgrade.
 */
export function LockedCompensationCard({ amountDollars }: Props) {
  const formatted = amountDollars.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-950/50 to-[var(--card)] p-5 shadow-lg shadow-black/25 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/90">Pro unlock</p>
          <p className="mt-1 text-lg font-bold text-white sm:text-xl">
            AI found a <span className="text-emerald-400">${formatted}</span> refund!
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Upgrade to Refyndra Pro for the full experience — deeper scans and AI Auto-Pilot.
          </p>
        </div>
        <Link
          href="/upgrade"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--background)] transition hover:opacity-95"
        >
          Upgrade to Pro
        </Link>
      </div>
    </div>
  );
}
