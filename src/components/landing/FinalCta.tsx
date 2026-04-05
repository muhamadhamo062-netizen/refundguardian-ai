import Link from 'next/link';

export function FinalCta() {
  return (
    <section className="border-t border-[var(--border)] bg-[var(--card)] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">
          Stop Missing Compensation
        </h2>
        <p className="mt-3 text-sm text-[var(--muted)] max-w-2xl mx-auto">
          Turn delays and order issues into money back. The Autonomous Compensation Engine runs in the
          background — detection and calculation are automatic; you see outcomes, you do not start the run.
        </p>
        <div className="mt-8">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-8 py-3 text-sm font-semibold text-[var(--background)] shadow-lg hover:bg-[var(--accent-muted)] transition-all hover:scale-[1.02]"
          >
            Scan My Orders Now
          </Link>
        </div>
      </div>
    </section>
  );
}

