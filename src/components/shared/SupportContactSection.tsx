import Link from 'next/link';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/supportContact';

type Props = {
  variant: 'terms' | 'privacy';
};

const INTRO: Record<Props['variant'], string> = {
  terms:
    'For questions about these Terms of Service, subscriptions, billing, or your account, email us at',
  privacy:
    'For privacy requests, questions about this Privacy Policy, or how we handle your data, email us at',
};

export function SupportContactSection({ variant }: Props) {
  return (
    <section
      className="mt-12 rounded-2xl border border-[var(--border)] bg-[var(--card)]/50 p-6 sm:p-8"
      aria-labelledby="legal-contact-heading"
    >
      <h2 id="legal-contact-heading" className="text-lg font-semibold text-white">
        Contact us
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]/90">
        {INTRO[variant]}{' '}
        <a
          href={SUPPORT_MAILTO}
          className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
        >
          {SUPPORT_EMAIL}
        </a>
        . We aim to respond within a few business days.
      </p>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Prefer a form? Visit{' '}
        <Link href="/support" className="font-medium text-[var(--accent)] underline-offset-2 hover:underline">
          Support
        </Link>
        .
      </p>
    </section>
  );
}
