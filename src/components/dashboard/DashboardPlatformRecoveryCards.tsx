import type { DashboardPlatformKey } from '@/lib/dashboard/platformRecovery';
import { PlatformOrderIcon } from '@/components/dashboard/PlatformOrderIcon';
import type { RefundPlatform } from '@/lib/refundPriorityEngine';

const PLATFORMS: { key: DashboardPlatformKey; label: string; icon: RefundPlatform }[] = [
  { key: 'amazon', label: 'Amazon', icon: 'amazon' },
  { key: 'uber_eats', label: 'Uber Eats', icon: 'uber_eats' },
  { key: 'uber_rides', label: 'Uber Rides', icon: 'uber_rides' },
  { key: 'doordash', label: 'DoorDash', icon: 'doordash' },
];

function formatUsdFromCents(cents: number): string {
  const n = Number.isFinite(cents) ? cents : 0;
  return `$${(n / 100).toFixed(2)}`;
}

type Props = {
  centsByPlatform: Record<DashboardPlatformKey, number>;
  /** Footer strip: compact cards, elegant, not bulky. */
  variant?: 'default' | 'footer';
};

export function DashboardPlatformRecoveryCards({ centsByPlatform, variant = 'default' }: Props) {
  const isFooter = variant === 'footer';
  return (
    <section
      className={
        isFooter
          ? 'mt-10 border-t border-white/[0.08] pt-8 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4'
          : 'mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4'
      }
      aria-label="Recovered amount by platform"
    >
      {isFooter ? (
        <div className="col-span-full mb-1">
          <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-300 sm:text-[10px] sm:text-zinc-500">
            By platform
          </h2>
        </div>
      ) : null}
      {PLATFORMS.map(({ key, label, icon }) => (
        <div
          key={key}
          className={
            isFooter
              ? 'relative flex min-h-[100px] min-w-0 flex-col justify-between overflow-hidden rounded-xl border border-emerald-500/15 bg-zinc-950/70 p-3 shadow-sm ring-1 ring-emerald-500/10'
              : 'relative flex aspect-square min-h-[132px] min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 shadow-[0_0_40px_rgba(99,102,241,0.12)] ring-1 ring-violet-500/20 backdrop-blur-md'
          }
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-violet-500/15 blur-2xl"
          />
          <div className="relative flex items-start justify-between gap-2">
            <PlatformOrderIcon platform={icon} size="default" />
            <span className="max-w-[50%] truncate text-right text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300 sm:text-zinc-500">
              {label}
            </span>
          </div>
          <div className="relative mt-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Recovered</p>
            <p
              className={
                isFooter
                  ? 'mt-0.5 font-mono text-lg font-bold tabular-nums tracking-tight text-emerald-300/95'
                  : 'mt-1 font-mono text-xl font-bold tabular-nums tracking-tight text-white sm:text-2xl'
              }
            >
              {formatUsdFromCents(centsByPlatform[key] ?? 0)}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}
