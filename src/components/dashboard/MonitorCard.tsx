import type { ReactNode } from 'react';

export interface MonitorCardProps {
  title: string;
  icon: ReactNode;
  ordersScanned: number;
  claimsSubmitted: number;
  refundsRecovered: number;
  accentColor?: 'emerald' | 'amber' | 'violet';
}

const iconColorClass = {
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  violet: 'text-violet-400',
};

export function MonitorCard({
  title,
  icon,
  ordersScanned,
  claimsSubmitted,
  refundsRecovered,
  accentColor = 'emerald',
}: MonitorCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--card)] to-[#0d0e12] shadow-lg shadow-black/20 transition-all duration-200 hover:border-[var(--border)]/80 hover:shadow-xl hover:shadow-black/25">
      <div className="relative p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 ${iconColorClass[accentColor]}`}
          >
            {icon}
          </div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
              Orders Scanned
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-white sm:text-xl">
              {ordersScanned.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
              Agent processed
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-white sm:text-xl">
              {claimsSubmitted.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
              Compensation recovered
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--accent)] sm:text-xl">
              {refundsRecovered.toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
