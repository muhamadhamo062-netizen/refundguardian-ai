import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

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

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-3xl font-bold text-white sm:text-4xl">Pricing</h1>
            <p className="mt-4 text-[var(--muted)] max-w-2xl mx-auto">
              Start free. Upgrade when you want more coverage and priority support.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
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
      </main>
      <Footer />
    </>
  );
}
