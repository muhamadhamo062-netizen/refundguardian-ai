/**
 * Elite dashboard masthead — centered Refyndra Pro + Command Center (English only).
 */
export function DashboardCommandCenterHero() {
  return (
    <div className="mb-8 w-full px-1 text-center sm:mb-10">
      <div className="mx-auto inline-flex flex-col items-center gap-1">
        <span className="text-xs font-semibold uppercase tracking-[0.42em] text-emerald-400 sm:text-sm sm:tracking-[0.38em]">
          Refyndra Pro
        </span>
        <h1 className="dashboard-hero-h1 text-white" style={{ lineHeight: 1.1 }}>
          <span className="block bg-gradient-to-r from-white via-zinc-100 to-zinc-300 bg-clip-text text-transparent">
            Command Center
          </span>
        </h1>
      </div>
      <p className="mx-auto mt-3 max-w-lg text-lg leading-snug text-zinc-300 sm:text-xl">
        One place to monitor recoveries, sync Gmail, and move fast when it matters.
      </p>
    </div>
  );
}
