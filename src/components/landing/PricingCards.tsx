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
    description: 'Unlimited scans and claims. Cancel anytime.',
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
        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-6 ${
                plan.featured
                  ? 'border-[var(--accent)] bg-[var(--card)] shadow-lg shadow-[var(--accent)]/10'
                  : 'border-[var(--border)] bg-[var(--card)]'
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--accent)] px-3 py-0.5 text-xs font-medium text-[var(--background)]">
                  Popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">{plan.price}</span>
                <span className="text-[var(--muted)]">{plan.period}</span>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">{plan.description}</p>
              <Link
                href={plan.href}
                className={`mt-6 block w-full rounded-lg py-3 text-center text-sm font-medium transition-colors ${
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
