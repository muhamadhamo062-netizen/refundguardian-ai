import type { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { SupportContactSection } from '@/components/shared/SupportContactSection';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/supportContact';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Refyndra collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pt-24 pb-20 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
        <p className="mt-4 text-[var(--muted)]">
          Last updated: {new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}
        </p>
        <div className="mt-10 space-y-8 text-[var(--foreground)]/90">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Overview</h2>
            <p>
              Refyndra AI helps you organize order signals you choose to connect and highlights potential refund
              or compensation opportunities. This policy describes what we collect, how we use it, and your choices.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Data we process</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--foreground)]/85">
              <li>Account information (authentication identifier, email) to keep your data scoped to your account.</li>
              <li>Order signals you choose to sync (e.g., merchant, dates, identifiers, totals) for analysis and display.</li>
              <li>Support messages you send through the Support form.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Email scanning (optional)</h2>
            <p className="text-sm text-[var(--foreground)]/85">
              If you connect Gmail using a Google App Password, it is encrypted on the server before storage. Scanning
              is limited to supported transactional senders and is used to extract order-related fields to populate your
              account.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">How we use data</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--foreground)]/85">
              <li>Operate the service (show orders, opportunities, and account status).</li>
              <li>Security and abuse prevention.</li>
              <li>Support and troubleshooting upon request.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Your choices</h2>
            <p className="text-sm text-[var(--foreground)]/85">
              You can disconnect integrations you&apos;ve linked and remove saved Gmail connection data from your account.
              For privacy-related requests, email{' '}
              <a href={SUPPORT_MAILTO} className="font-medium text-[var(--accent)] hover:underline">
                {SUPPORT_EMAIL}
              </a>{' '}
              or use our Support page.
            </p>
            <p className="text-sm text-[var(--muted)]">
              Help center:{' '}
              <Link href="/support" className="text-[var(--accent)] hover:underline">
                Support
              </Link>
              .
            </p>
          </section>
        </div>

        <SupportContactSection variant="privacy" />

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
