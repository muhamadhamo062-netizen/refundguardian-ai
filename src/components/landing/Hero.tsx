import Link from 'next/link';

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-32 pb-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
          Stop Losing Money on Late Deliveries.
        </h1>
        <p className="mt-6 text-lg text-[var(--foreground)]/80 sm:text-xl max-w-2xl mx-auto">
          Our AI automatically detects delays and claims refunds for you.
        </p>
        <div className="mt-10">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-8 py-4 text-base font-semibold text-[var(--background)] shadow-lg hover:bg-[var(--accent-muted)] transition-all hover:scale-[1.02]"
          >
            Start Free
          </Link>
        </div>
      </div>
    </section>
  );
}
