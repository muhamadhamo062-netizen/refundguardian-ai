import Link from 'next/link';

const plans = [
  {
    name: 'Free Risk-Free Start',
    price: '$0',
    period: 'until we win',
    description: 'Try with no upfront cost. Pay only when we recover money for you.',
    cta: 'Get Started',
    href: '/login',
    featured: false,
  },
  {
    name: 'Monthly Advocate',
    price: '$9.99',
    period: '/month',
    description: 'Unlimited scans and full autonomous agent coverage. Cancel anytime.',
    cta: 'Choose Monthly',
    href: '/login',
    featured: true,
  },
  {
    name: 'Annual Guardian',
    price: '$89.99',
    period: '/year',
    description: 'Best value. Two months free compared to monthly.',
    cta: 'Choose Annual',
    href: '/login',
    featured: false,
  },
];

export function PricingCards() {
  return (
    <section className="border-t border-[var(--border)] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl font-bold text-white sm:text-4xl text-center">
          Pricing
        </h2>
        <div className="mt-10 grid grid-cols-3 gap-3 sm:mt-16 sm:gap-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-3 transition-all duration-150 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40 sm:p-6 ${
                plan.featured
                  ? 'border-[var(--accent)] bg-[var(--card)] shadow-lg shadow-[var(--accent)]/10 ring-1 ring-[var(--accent)]/60'
                  : 'border-[var(--border)] bg-[var(--card)]'
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-medium text-[var(--background)] sm:-top-3 sm:px-3 sm:text-xs">
                  Popular
                </span>
              )}
              <h3 className="text-sm font-semibold text-white sm:text-lg">{plan.name}</h3>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-1 gap-y-0.5 sm:mt-4">
                <span className="text-xl font-bold text-white sm:text-3xl">{plan.price}</span>
                <span className="text-[11px] text-[var(--muted)] sm:text-base">{plan.period}</span>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-[var(--muted)] sm:text-sm">{plan.description}</p>
              <Link
                href={plan.href}
                className={`mt-3 block w-full rounded-lg py-2 text-center text-[11px] font-semibold transition-colors sm:mt-6 sm:py-3 sm:text-sm ${
                  plan.featured
                    ? 'bg-[var(--accent)] text-[var(--background)] hover:bg-[var(--accent-muted)]'
                    : 'border border-[var(--border)] text-white hover:bg-[var(--card-hover)]'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
