import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

function IconShield() {
  return (
    <svg className="h-5 w-5 shrink-0 text-emerald-400/90" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg className="h-5 w-5 shrink-0 text-emerald-400/90" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 3v4M8 3v4M3 11h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconReceipt() {
  return (
    <svg className="h-5 w-5 shrink-0 text-emerald-400/90" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 3h6a2 2 0 012 2v16l-3-2-3 2-3-2-3 2V5a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9 9h6M9 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

type Plan = {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  cta: string;
  href: string;
  variant: 'free' | 'monthly' | 'annual';
};

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free Risk-Free Start',
    price: '$0',
    period: 'until we win',
    description: 'Try with no upfront cost. Pay only when we recover money for you.',
    cta: 'Get Started',
    href: '/signup',
    variant: 'free',
  },
  {
    id: 'monthly',
    name: 'Monthly Guardian',
    price: '$9.99',
    period: '/month',
    description: 'Unlimited scans and full autonomous coverage. Upgrade or downgrade anytime.',
    cta: 'Subscribe',
    href: '/upgrade',
    variant: 'monthly',
  },
  {
    id: 'annual',
    name: 'Annual Guardian',
    price: '$89.99',
    period: '/year',
    description: 'Our best rate for committed savers — same power as monthly, less out of pocket.',
    cta: 'Subscribe',
    href: '/upgrade',
    variant: 'annual',
  },
];

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen overflow-x-hidden bg-[var(--background)] pb-24 pt-24 sm:pb-28 sm:pt-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-400/90 sm:text-xs">
              Simple pricing
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              Pricing
            </h1>
            <p className="mt-4 text-lg font-medium text-emerald-100/95 sm:text-xl">
              Let your refunds pay for your subscription
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
              Start free. Upgrade when you want full automation, priority signals, and maximum recoveries.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 pb-2 md:mt-16 md:grid-cols-3 md:items-stretch md:gap-6 md:py-2 lg:mt-20 lg:gap-8">
            {plans.map((plan) => {
              const isAnnual = plan.variant === 'annual';
              const isMonthly = plan.variant === 'monthly';

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border p-6 sm:p-7 ${
                    isAnnual
                      ? 'z-10 border-emerald-400/45 bg-gradient-to-b from-emerald-950/[0.45] via-[var(--card)] to-[var(--card)] shadow-[0_0_48px_-12px_rgba(52,211,153,0.42)] ring-1 ring-emerald-400/35 md:scale-[1.06] md:py-8'
                      : 'border-[var(--border)] bg-[var(--card)]/90 md:scale-100'
                  }`}
                >
                  {isAnnual ? (
                    <span className="absolute -top-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-950 shadow-lg shadow-emerald-500/30 sm:text-xs">
                      Best Value
                    </span>
                  ) : null}

                  <div className="flex flex-1 flex-col pt-1">
                    <h2 className="text-lg font-semibold text-white sm:text-xl">{plan.name}</h2>

                    <div className="mt-5 flex flex-wrap items-end gap-x-2 gap-y-2">
                      <div className="flex flex-wrap items-baseline gap-x-1.5">
                        <span
                          className={`font-bold tabular-nums text-white ${isAnnual ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'}`}
                        >
                          {plan.price}
                        </span>
                        <span className="text-sm text-[var(--muted)] sm:text-base">{plan.period}</span>
                      </div>
                      {isAnnual ? (
                        <span className="inline-flex items-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 sm:text-xs">
                          Save 25% (2 Months Free)
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-4 flex-1 text-sm leading-relaxed text-[var(--muted)]">{plan.description}</p>

                    <Link
                      href={plan.href}
                      className={`mt-8 inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-5 text-base font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
                        isAnnual
                          ? 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/25 hover:bg-emerald-400'
                          : isMonthly
                            ? 'bg-[var(--accent)] text-[var(--background)] hover:bg-[var(--accent-muted)]'
                            : 'border border-[var(--border)] bg-[var(--background)]/50 text-white hover:bg-[var(--card-hover)]'
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="mx-auto mt-14 max-w-4xl rounded-2xl border border-white/[0.06] bg-[var(--card)]/40 px-4 py-6 sm:mt-16 sm:px-8 sm:py-8"
            aria-label="Trust and checkout"
          >
            <ul className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-10 sm:gap-y-4">
              <li className="flex items-center gap-3 text-sm text-zinc-300">
                <IconShield />
                <span>
                  <span className="font-medium text-white">Secure Checkout</span> by Paddle
                </span>
              </li>
              <li className="flex items-center gap-3 text-sm text-zinc-300">
                <IconCalendar />
                <span className="font-medium text-white">Cancel Anytime</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-zinc-300">
                <IconReceipt />
                <span className="font-medium text-white">No Hidden Fees</span>
              </li>
            </ul>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
