const rows = [
  { old: 'Manual forms', radar: 'Zero-effort automation' },
  { old: 'Upload receipts', radar: 'Live order detection' },
  { old: 'Time-consuming back-and-forth', radar: 'Autonomous AI refund processing' },
  { old: 'You watch every order', radar: 'Background monitoring 24/7' },
];

/** Marketing / SaaS feature comparison — public landing only */
export function RefundRadarHeroComparison() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-[var(--card)] to-zinc-950/95 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-30%,rgba(34,197,94,0.12),transparent)]" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400/90 sm:text-xs">
          Refund intelligence
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
          Legacy tools vs RefundGuardian AI
        </h2>
        <p className="mt-2 max-w-2xl text-base text-[var(--muted)] sm:text-base">
          Same platforms — a smarter way to find missed money without the busywork.
        </p>

        {/* Two columns side-by-side on mobile (no horizontal scroll) */}
        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          <div className="w-full">
            <table className="w-full table-fixed text-base font-medium leading-snug sm:text-sm sm:font-normal">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="w-1/2 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-300 sm:px-5 sm:py-4 sm:text-[10px] sm:text-zinc-400">
                    Legacy system
                  </th>
                  <th className="w-1/2 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-emerald-300 sm:px-5 sm:py-4 sm:text-[10px]">
                    RefundGuardian AI
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.old} className="border-b border-white/5 last:border-0">
                    <td className="px-3 py-3 align-top text-zinc-300 sm:px-5 sm:py-4">
                      <span className="mr-2 text-red-400/90" aria-hidden>
                        ×
                      </span>
                      <span className="break-words">{r.old}</span>
                    </td>
                    <td className="px-3 py-3 align-top text-zinc-100 sm:px-5 sm:py-4">
                      <span className="mr-2 text-emerald-400" aria-hidden>
                        ✓
                      </span>
                      <span className="break-words">{r.radar}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
