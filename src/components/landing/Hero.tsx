import Link from 'next/link';
import { LANDING_PRIMARY_CTA_GLOW } from '@/lib/landingPrimaryCta';

const PLATFORMS = ['Amazon', 'Uber Eats', 'Uber Rides', 'DoorDash'] as const;

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-32 pb-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-balance bg-gradient-to-br from-white via-white to-emerald-200/90 bg-clip-text pb-px text-transparent text-4xl font-semibold tracking-tight antialiased sm:text-5xl md:text-6xl">
          Get money back from late deliveries — automatically.
        </h1>
        <h2 className="mt-5 text-balance text-lg font-semibold tracking-tight text-white/95 sm:text-xl max-w-2xl mx-auto">
          <span className="text-emerald-200/95">Built for U.S. shoppers</span>
          <span className="text-white/90">
            {' '}
            — automated Amazon refunds, Uber trip delay compensation &amp; DoorDash late-order help.
          </span>
        </h2>
        <p className="mt-6 text-balance text-base text-[var(--foreground)]/80 sm:text-lg max-w-2xl mx-auto">
          Refyndra detects issues, estimates what you may be owed, and surfaces clear next steps. You stay in control —
          we don&apos;t file claims without you.
        </p>
        <p className="mt-3 text-sm text-[var(--muted)] max-w-xl mx-auto">
          Works silently in the background. No manual effort.
        </p>
        <div
          className="mx-auto mt-6 max-w-3xl rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-transparent px-3 py-3 shadow-inner shadow-black/30 sm:px-5 sm:py-4"
          aria-label="Supported platforms"
        >
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {PLATFORMS.map((name) => (
              <li
                key={name}
                className="flex min-h-[2.875rem] items-center justify-center rounded-xl border border-white/[0.06] bg-[var(--background)]/40 px-2 py-2.5 text-center text-[13px] font-semibold tracking-tight text-zinc-100 shadow-sm shadow-black/20 sm:min-h-[3rem] sm:text-sm"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4 sm:justify-center">
          <Link
            href="/signup"
            className={`inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-8 py-3.5 text-sm sm:text-base font-semibold text-[var(--background)] ${LANDING_PRIMARY_CTA_GLOW}`}
          >
            Start free trial
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-[var(--background)]/60 px-6 py-3 text-sm font-semibold text-[var(--accent)] shadow-[0_0_24px_rgba(16,185,129,0.2)] backdrop-blur-sm transition-all duration-300 ease-out hover:scale-[1.03] hover:border-emerald-400/35 hover:bg-[var(--card-hover)] hover:shadow-[0_0_32px_rgba(16,185,129,0.28)] active:scale-[0.98]"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-4 text-xs text-[var(--muted)] max-w-md mx-auto">
          Free trial includes a limited AI scan on recent orders. Upgrade via Secure Checkout when you want full
          automation — never charged without explicit checkout.
        </p>
      </div>
    </section>
  );
}
