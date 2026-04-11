import Link from 'next/link';
import { LANDING_EMPHASIS_CTA_GLOW, LANDING_PRIMARY_CTA_GLOW } from '@/lib/landingPrimaryCta';

const plans = [
  {
    id: 'free',
    name: 'Free Risk-Free Start',
    price: '$0',
    period: 'until we win',
    description: 'Try with no upfront cost. Pay only when we recover money for you.',
    cta: 'Get Started',
    href: '/signup',
    variant: 'free' as const,
  },
  {
    id: 'monthly',
    name: 'Monthly Guardian',
    price: '$9.99',
    period: '/month',
    description: 'Unlimited scans and full autonomous coverage.',
    cta: 'Subscribe',
    href: '/upgrade',
    variant: 'monthly' as const,
  },
  {
    id: 'annual',
    name: 'Annual Guardian',
    price: '$89.99',
    period: '/year',
    description: 'Best rate — same power as monthly, less out of pocket.',
    cta: 'Subscribe',
    href: '/upgrade',
    variant: 'annual' as const,
  },
];

export function PricingCards() {
  return (
    <section className="border-t border-[var(--border)] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400/85">
          Pricing
        </p>
        <h2 className="mt-2 text-center text-3xl font-bold text-white sm:text-4xl">
          Let your refunds pay for your subscription
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-[var(--muted)] sm:text-base">
          Amazon late delivery compensation, Uber Eats &amp; DoorDash help — start free, upgrade when you&apos;re ready.
          Annual saves the most.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-8 sm:mt-12 md:grid-cols-3 md:items-stretch md:gap-6 lg:gap-8">
          {plans.map((plan) => {
            const isAnnual = plan.variant === 'annual';
            const isMonthly = plan.variant === 'monthly';

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-6 backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-0.5 sm:p-7 ${
                  isAnnual
                    ? 'z-10 border border-emerald-400/40 bg-gradient-to-b from-emerald-950/45 to-[var(--card)]/65 shadow-[0_0_48px_-12px_rgba(52,211,153,0.45)] ring-1 ring-emerald-400/35 md:scale-[1.05]'
                    : 'border border-white/10 bg-[var(--card)]/75 shadow-xl shadow-black/20 hover:border-white/[0.14] hover:shadow-2xl hover:shadow-black/40'
                }`}
              >
                {isAnnual ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-950 shadow-md sm:text-xs">
                    Best Value
                  </span>
                ) : null}

                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                <div className="mt-4 flex flex-wrap items-end gap-2">
                  <div className="flex flex-wrap items-baseline gap-1">
                    <span className={`font-bold tabular-nums text-white ${isAnnual ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}>
                      {plan.price}
                    </span>
                    <span className="text-sm text-[var(--muted)]">{plan.period}</span>
                  </div>
                  {isAnnual ? (
                    <span className="rounded-md border border-emerald-500/35 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 sm:text-[11px]">
                      Save 25% (2 Months Free)
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--muted)]">{plan.description}</p>
                <Link
                  href={plan.href}
                  className={`mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl px-4 text-sm font-semibold sm:text-base ${
                    isAnnual
                      ? `bg-emerald-500 text-zinc-950 hover:bg-emerald-400 ${LANDING_EMPHASIS_CTA_GLOW}`
                      : isMonthly
                        ? `bg-[var(--accent)] text-[var(--background)] hover:bg-[var(--accent-muted)] ${LANDING_PRIMARY_CTA_GLOW}`
                        : 'border border-white/10 bg-[var(--background)]/40 text-white shadow-sm backdrop-blur-sm transition-all duration-300 ease-out hover:scale-[1.03] hover:border-emerald-500/25 hover:bg-[var(--card-hover)] active:scale-[0.98]'
                  }`}
                >
                  {plan.cta}
                </Link>
                {isAnnual ? (
                  <p className="mt-3 text-center text-[11px] leading-snug text-emerald-200/90 sm:text-xs">
                    Break even with just a few refunds. Only $7.49/month billed annually.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-zinc-500 sm:text-sm">
          Secure Checkout by Paddle · Cancel anytime · No hidden fees
        </p>
      </div>
    </section>
  );
}
