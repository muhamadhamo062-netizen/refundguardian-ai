export function Testimonials() {
  const testimonials = [
    {
      name: 'Alex M.',
      quote: 'Got money back from Amazon I would have missed on my own.',
    },
    {
      name: 'Jordan R.',
      quote: 'Nice to see refunds surfaced without digging through order history.',
    },
    {
      name: 'Priya K.',
      quote: 'RefundGuardian caught a delay I had not followed up on.',
    },
  ];

  return (
    <section className="border-t border-[var(--border)] bg-[var(--background)] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">
          Users recovered money from missed refunds
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-[var(--muted)]">
          Real stories from people using RefundGuardian AI to turn overlooked issues into money back.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="flex h-full flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-transform duration-150 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/40"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)]/10 text-xs font-semibold text-[var(--accent)]">
                    {t.name[0]}
                  </span>
                  <span className="text-sm font-medium text-white">{t.name}</span>
                </div>
                <p className="mt-4 text-sm text-[var(--muted)]">&ldquo;{t.quote}&rdquo;</p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 3.5 9.2 9.1l-6.1.5 4.6 4-1.4 5.9L12 16.6l5.7 2.9-1.4-5.9 4.6-4-6.1-.5z" />
                  </svg>
                ))}
              </div>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
