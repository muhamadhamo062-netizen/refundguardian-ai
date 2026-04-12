// Mobile update v2 - 2026-04-11T18:30:00Z — audit: text-base + sm:text-sm for body UI
import Link from 'next/link';
import { LANDING_PRIMARY_CTA_GLOW } from '@/lib/landingPrimaryCta';

const PLATFORMS = ['Amazon', 'Uber Eats', 'Uber Rides', 'DoorDash'] as const;

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-32 pb-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-balance bg-gradient-to-br from-white via-white to-emerald-200/90 bg-clip-text pb-px text-transparent text-4xl font-bold !leading-tight tracking-tight antialiased sm:text-5xl md:text-6xl">
          Get money back from late deliveries — automatically.
        </h1>
        <h2 className="mx-auto mt-5 max-w-2xl text-balance text-2xl font-semibold !leading-tight tracking-tight text-white/95 sm:text-2xl md:text-3xl">
          <span className="text-emerald-200/95">Built for U.S. shoppers</span>
          <span className="text-white/90">
            {' '}
            — automated Amazon refunds, Uber trip delay compensation &amp; DoorDash late-order help.
          </span>
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg !font-medium leading-relaxed text-zinc-100 sm:text-lg sm:!font-normal sm:text-[var(--foreground)]/90">
          Refyndra detects issues, estimates what you may be owed, and surfaces clear next steps. You stay in control —
          we don&apos;t file claims without you.
        </p>
        <p className="mx-auto mt-3 max-w-xl text-balance text-base font-medium leading-relaxed text-zinc-300 sm:text-sm sm:font-normal sm:text-[var(--muted)]">
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
                className="flex min-h-[3.25rem] items-center justify-center rounded-xl border border-white/[0.06] bg-[var(--background)]/40 px-2 py-2.5 text-center text-base font-bold leading-tight tracking-tight text-zinc-50 shadow-sm shadow-black/20 sm:min-h-[3rem] sm:text-sm sm:font-semibold sm:text-zinc-100"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4 sm:justify-center">
          <Link
            href="/signup"
            className={`inline-flex min-h-[52px] items-center justify-center rounded-xl bg-[var(--accent)] px-8 py-3.5 text-base font-bold leading-tight text-[var(--background)] sm:min-h-0 sm:text-sm sm:font-semibold ${LANDING_PRIMARY_CTA_GLOW}`}
          >
            Start free trial
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-white/10 bg-[var(--background)]/60 px-6 py-3 text-base font-bold leading-tight text-[var(--accent)] shadow-[0_0_24px_rgba(16,185,129,0.2)] backdrop-blur-sm transition-all duration-300 ease-out hover:scale-[1.03] hover:border-emerald-400/35 hover:bg-[var(--card-hover)] hover:shadow-[0_0_32px_rgba(16,185,129,0.28)] active:scale-[0.98] sm:min-h-0 sm:text-sm sm:font-semibold"
          >
            Sign in
          </Link>
        </div>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed font-medium text-zinc-400 sm:text-sm sm:font-normal sm:text-[var(--muted)]">
          Free trial includes a limited AI scan on recent orders. Upgrade via Secure Checkout when you want full
          automation — never charged without explicit checkout.
        </p>
      </div>
    </section>
  );
}
