const testimonials = [
  {
    name: 'Alex M.',
    initial: 'A',
    tag: 'Amazon Prime Member',
    platform: 'Amazon',
    platformShort: 'Amazon',
    amount: '$15.40',
    quote:
      "I honestly didn't think a 10-minute delay mattered until Refyndra caught it. Got my money back without even asking.",
  },
  {
    name: 'Jordan R.',
    initial: 'J',
    tag: 'Frequent Uber Eats diner',
    platform: 'Uber Eats',
    platformShort: 'Uber Eats',
    amount: '$7.00',
    quote:
      "Finally, a tool that audits my receipts. It's like having a personal accountant for my food deliveries.",
  },
  {
    name: 'Priya K.',
    initial: 'P',
    tag: 'DoorDash regular',
    platform: 'DoorDash',
    platformShort: 'DoorDash',
    amount: '$12.00',
    quote:
      'Refyndra found 3 delayed orders from last month I totally forgot about. The AI handled everything.',
  },
] as const;

function StarRow({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-0.5 text-amber-400/95 ${className ?? ''}`} aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3.5 9.2 9.1l-6.1.5 4.6 4-1.4 5.9L12 16.6l5.7 2.9-1.4-5.9 4.6-4-6.1-.5z" />
        </svg>
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="border-t border-[var(--border)] bg-[var(--background)] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-semibold text-white sm:text-3xl">
          Real Amazon refunds &amp; late delivery wins from Refyndra users
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-base text-[var(--muted)] sm:text-sm">
          Real stories from people using Refyndra AI to turn overlooked issues into money back.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="group flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 md:hover:-translate-y-0.5 md:hover:border-emerald-500/25 md:hover:shadow-[0_12px_48px_-16px_rgba(16,185,129,0.28)] md:hover:shadow-emerald-500/10"
            >
              <div className="mb-4 inline-flex w-fit max-w-full rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-300 sm:text-[10px] sm:py-1 sm:text-zinc-400">
                {t.tag}
              </div>

              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-base font-semibold text-emerald-400/95 sm:text-xs sm:font-medium">Recovered {t.amount}</span>
                <span className="text-base text-[var(--muted)] sm:text-xs">from</span>
                <span className="text-base font-semibold text-white sm:text-xs">{t.platformShort}</span>
              </div>

              <blockquote className="mt-4 flex-1">
                <p className="text-base leading-relaxed text-[var(--foreground)]/90 sm:text-sm sm:text-[var(--foreground)]/85">&ldquo;{t.quote}&rdquo;</p>
              </blockquote>

              <figcaption className="mt-6 flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/12 text-base font-semibold text-[var(--accent)] ring-1 ring-[var(--accent)]/25 sm:h-10 sm:w-10 sm:text-sm"
                    aria-hidden
                  >
                    {t.initial}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-white sm:text-sm">{t.name}</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-200/95 sm:text-[10px]">
                        <svg
                          className="h-3 w-3 text-emerald-400"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                          />
                        </svg>
                        Verified user
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
                  <span className="sr-only">5 out of 5 stars</span>
                  <StarRow className="justify-end" />
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
