const rows = [
  { old: 'Manual forms', radar: 'Zero-effort automation' },
  { old: 'Upload receipts', radar: 'Live order detection' },
  { old: 'Endless Customer Support Chats', radar: 'Autonomous AI refund processing' },
  { old: 'You watch every order', radar: 'Background monitoring 24/7' },
  { old: 'Your Effort: Hours of manual work', radar: 'Gmail inbox setup (once per device)' },
];

/** Marketing / SaaS feature comparison — public landing only */
export function RefyndraHeroComparison() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-950/95 via-[var(--card)] to-black p-6 shadow-2xl shadow-black/50 sm:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-20%,rgba(139,92,246,0.18),transparent)]" />
      <div className="pointer-events-none absolute -right-24 -top-20 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-violet-300/90 sm:text-xs">
          Conversion highlight
        </p>
        <h2 className="mt-3 text-balance text-4xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
          Stop Wasting Time the Old Way. Let AI Handle the Hard Work.
        </h2>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-zinc-200 sm:text-base">
          Same platforms — a smarter way to find missed money without the busywork.
        </p>

        <div className="mt-8 hidden overflow-hidden rounded-2xl border border-white/10 bg-black/25 md:block">
          <div className="w-full overflow-x-auto">
            <table className="w-full table-fixed text-lg font-medium leading-snug text-zinc-100 sm:text-base">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="w-1/2 px-6 py-5 text-left text-sm font-semibold uppercase tracking-[0.18em] text-zinc-300">
                    The Old, Boring Way
                  </th>
                  <th className="relative w-1/2 border-l border-violet-400/45 bg-gradient-to-br from-violet-500/20 via-violet-500/10 to-transparent px-6 py-5 text-left text-sm font-semibold uppercase tracking-[0.18em] text-violet-100 shadow-[0_0_0_1px_rgba(167,139,250,0.4),inset_0_0_30px_rgba(139,92,246,0.18)]">
                    <span className="relative z-10">Refyndra AI</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.old}-${r.radar}`} className="border-b border-white/5 last:border-0">
                    <td className="px-6 py-5 align-top text-zinc-200">
                      <span className="mr-2 text-xl font-bold text-red-400/95" aria-hidden>
                        ✕
                      </span>
                      <span className="break-words">{r.old}</span>
                    </td>
                    <td className="relative border-l border-violet-400/40 bg-gradient-to-br from-violet-500/[0.18] via-violet-500/[0.08] to-transparent px-6 py-5 align-top text-white shadow-[inset_0_0_24px_rgba(139,92,246,0.12)]">
                      <span className="mr-2 text-2xl font-extrabold text-lime-400 drop-shadow-[0_0_10px_rgba(132,204,22,0.85)]" aria-hidden>
                        ✓
                      </span>
                      <span className="break-words font-semibold text-white">{r.radar}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <article className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/35 shadow-lg shadow-black/35 md:hidden">
          <div className="grid grid-cols-2 border-b border-white/10 bg-white/[0.03]">
            <p className="px-3 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">Old Way</p>
            <p className="border-l border-violet-400/40 bg-gradient-to-br from-violet-500/20 via-violet-500/10 to-transparent px-3 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-violet-100">
              Refyndra AI
            </p>
          </div>
          <div className="divide-y divide-white/10">
            {rows.map((r) => (
              <div key={`${r.old}-${r.radar}-mobile`} className="grid grid-cols-2">
                <p className="flex items-start gap-2 px-3 py-3 text-[1.02rem] leading-snug text-zinc-100">
                  <span className="mt-0.5 text-lg font-bold text-red-400/95" aria-hidden>
                    ✕
                  </span>
                  <span>{r.old}</span>
                </p>
                <p className="flex items-start gap-2 border-l border-violet-400/30 bg-gradient-to-br from-violet-500/16 via-violet-500/8 to-transparent px-3 py-3 text-[1.02rem] font-semibold leading-snug text-white">
                  <span
                    className="mt-0.5 text-xl font-extrabold text-lime-400 drop-shadow-[0_0_10px_rgba(132,204,22,0.85)]"
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span>{r.radar}</span>
                </p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
