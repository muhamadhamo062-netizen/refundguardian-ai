import Link from 'next/link';

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-32 pb-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">
          Get money back from late deliveries — automatically.
        </h1>
        <p className="mt-6 text-balance text-base text-[var(--foreground)]/80 sm:text-lg max-w-2xl mx-auto">
          Automated compensation AI — detects issues, calculates what you&apos;re owed, and applies
          enhancements when conditions qualify. You see outcomes; you don&apos;t start the process.
        </p>
        <p className="mt-3 text-sm text-[var(--muted)] max-w-xl mx-auto">
          Works silently in the background. No manual effort.
        </p>
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
          Amazon · Uber Eats · Uber Rides
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4 sm:justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-8 py-3.5 text-sm sm:text-base font-semibold text-[var(--background)] shadow-lg hover:bg-[var(--accent-muted)] transition-all hover:scale-[1.02]"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl border border-[var(--accent)]/80 bg-[var(--background)] px-6 py-3 text-sm font-semibold text-[var(--accent)] shadow-[0_0_25px_rgba(16,185,129,0.25)] hover:bg-[var(--card-hover)] transition-all"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-4 text-xs text-[var(--muted)] max-w-md mx-auto">
          Connect Gmail once. We store your app password encrypted so background scans can run automatically.
        </p>
      </div>
    </section>
  );
}
