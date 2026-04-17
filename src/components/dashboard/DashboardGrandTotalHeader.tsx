type Props = {
  grandTotalCents: number;
  ordersScanned: number;
  pendingClaims: number;
  /** Total registered users (global community KPI). */
  globalUserCount?: number | null;
};

function formatUsdFromCents(cents: number): string {
  const n = Number.isFinite(cents) ? cents : 0;
  return `$${(n / 100).toFixed(2)}`;
}

/** Large glowing green dollar total — financial command center hero. */
export function DashboardGrandTotalHeader({
  grandTotalCents,
  ordersScanned,
  pendingClaims,
  globalUserCount,
}: Props) {
  const total = formatUsdFromCents(grandTotalCents);
  const globalLabel =
    typeof globalUserCount === 'number' && Number.isFinite(globalUserCount)
      ? globalUserCount.toLocaleString()
      : null;
  return (
    <header className="w-full shrink-0 border-b border-emerald-500/25 pb-6 sm:pb-8">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-400 sm:text-[11px]">
        Grand total recovered
      </p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div
          className="relative inline-block min-w-0"
          aria-label={`Grand total recovered ${total}`}
        >
          {/* Neon bloom layers */}
          <span
            className="pointer-events-none absolute -inset-6 -z-10 opacity-95"
            aria-hidden
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(0,255,0,0.4) 0%, rgba(0,255,0,0.15) 45%, transparent 72%)',
              filter: 'blur(28px)',
            }}
          />
          <span
            className="pointer-events-none absolute inset-0 -z-10 blur-3xl"
            aria-hidden
            style={{
              background: 'radial-gradient(circle at 50% 40%, rgba(0,255,0,0.35) 0%, transparent 65%)',
            }}
          />
          <p
            className="relative font-mono text-5xl font-bold tabular-nums tracking-tight sm:text-6xl md:text-7xl"
            style={{
              color: '#6ee7b7',
              textShadow:
                '0 0 12px rgba(52,211,153,0.95), 0 0 28px rgba(16,185,129,0.85), 0 0 48px rgba(5,150,105,0.55), 0 0 72px rgba(4,120,87,0.35)',
              filter: 'drop-shadow(0 0 2px rgba(167,243,208,0.9))',
            }}
          >
            {total}
          </p>
        </div>
        <p className="text-base leading-relaxed text-zinc-200 sm:max-w-[min(100%,28rem)] sm:text-sm sm:text-right sm:text-zinc-400">
          Orders synced: <span className="font-semibold text-white">{ordersScanned}</span>
          <span className="mx-2 text-zinc-600 sm:text-zinc-700">·</span>
          Pending claims: <span className="font-semibold text-white">{pendingClaims}</span>
          {globalLabel !== null && (
            <>
              <span className="mx-2 text-zinc-600 sm:text-zinc-700">·</span>
              Global users: <span className="font-semibold text-emerald-200/95">{globalLabel}</span>
            </>
          )}
        </p>
      </div>
    </header>
  );
}
