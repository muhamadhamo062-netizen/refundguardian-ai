import type { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { SupportContactSection } from '@/components/shared/SupportContactSection';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/supportContact';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for Refyndra — refund automation and subscription terms.',
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pt-24 pb-20 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
        <p className="mt-4 text-[var(--muted)]">
          Last updated: {new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}
        </p>
        <div className="mt-8 space-y-4 text-[var(--foreground)]/90">
          <p>
            By using Refyndra AI, you agree to use the product only for lawful purposes and in line with
            each merchant&apos;s terms. The service provides tools and estimates; outcomes depend on merchants
            and your own follow-up.
          </p>
          <p>
            Subscriptions and trials are described at checkout. You are responsible for keeping your account
            credentials secure. We may update these terms; continued use after changes constitutes acceptance.
          </p>
          <p className="text-sm text-[var(--foreground)]/85">
            Nothing on this site constitutes legal, tax, or financial advice. If you need help with your
            account or these terms, use the contact information below.
          </p>
        </div>

        <SupportContactSection variant="terms" />

        <p className="mt-10 border-t border-[var(--border)] pt-8 text-center text-sm text-[var(--muted)]">
          Official support:{' '}
          <a href={SUPPORT_MAILTO} className="font-medium text-[var(--accent)] hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>

        <Link href="/" className="mt-6 inline-block text-[var(--accent)] hover:underline">
          ← Back to home
        </Link>
      </main>
      <Footer />
    </>
  );
}
