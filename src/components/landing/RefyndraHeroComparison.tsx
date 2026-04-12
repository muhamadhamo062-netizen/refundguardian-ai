const rows = [
  { old: 'Manual forms', radar: 'Zero-effort automation' },
  { old: 'Upload receipts', radar: 'Live order detection' },
  { old: 'Endless Customer Support Chats', radar: 'Autonomous AI refund processing' },
  { old: 'You watch every order', radar: 'Background monitoring 24/7' },
  { old: 'Your Effort: Hours of manual work', radar: 'One-click setup' },
];

/** Marketing / SaaS feature comparison — public landing only */
export function RefyndraHeroComparison() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-[var(--card)] to-zinc-950/95 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-30%,rgba(34,197,94,0.12),transparent)]" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400/90 sm:text-xs">
          Refund intelligence
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
          Legacy refund tools vs automated Amazon refunds &amp; AI recovery
        </h2>
        <p className="mt-2 max-w-2xl text-base text-[var(--muted)] sm:text-base">
          Same platforms — a smarter way to find missed money without the busywork.
        </p>

        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          <div className="w-full">
            <table className="w-full table-fixed text-base font-medium leading-snug sm:text-sm sm:font-normal">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="w-1/2 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-300 sm:px-5 sm:py-4 sm:text-[10px] sm:text-zinc-400">
                    The Old, Boring Way
                  </th>
                  <th className="relative w-1/2 border-l border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-emerald-200 shadow-[inset_0_0_24px_rgba(16,185,129,0.12)] sm:px-5 sm:py-4 sm:text-[10px]">
                    <span className="relative z-10">Refyndra AI</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.old}-${r.radar}`} className="border-b border-white/5 last:border-0">
                    <td className="px-3 py-3 align-top text-zinc-300 sm:px-5 sm:py-4">
                      <span className="mr-2 text-red-400/90" aria-hidden>
                        ×
                      </span>
                      <span className="break-words">{r.old}</span>
                    </td>
                    <td className="relative border-l border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.09] via-emerald-500/[0.04] to-transparent px-3 py-3 align-top text-zinc-100 shadow-[inset_0_0_20px_rgba(16,185,129,0.06)] sm:px-5 sm:py-4">
                      <span className="mr-2 text-emerald-400" aria-hidden>
                        ✓
                      </span>
                      <span className="break-words font-medium text-white">{r.radar}</span>
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
