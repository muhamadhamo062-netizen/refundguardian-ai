import Link from 'next/link';
import { LANDING_PRIMARY_CTA_GLOW } from '@/lib/landingPrimaryCta';

export function FinalCta() {
  return (
    <section className="border-t border-[var(--border)] bg-[var(--card)] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-4xl font-bold text-white sm:text-4xl">
          Stop Leaving Money on the Table.
        </h2>
        <p className="mt-3 text-base text-[var(--muted)] max-w-2xl mx-auto sm:text-base">
          Join 8,000+ users who let Refyndra handle the headache while they keep the cash.
        </p>
        <div className="mt-8">
          <Link
            href="/signup"
            className={`inline-flex min-h-[52px] items-center justify-center rounded-xl bg-[var(--accent)] px-8 py-3.5 text-base font-bold text-[var(--background)] sm:min-h-0 sm:py-3 sm:text-sm sm:font-semibold ${LANDING_PRIMARY_CTA_GLOW}`}
          >
            Start Now
          </Link>
        </div>
      </div>
    </section>
  );
}

