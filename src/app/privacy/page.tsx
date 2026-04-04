import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pt-24 pb-20 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
        <p className="mt-4 text-[var(--muted)]">
          Last updated: {new Date().toLocaleDateString()}
        </p>
        <div className="mt-10 space-y-8 text-[var(--foreground)]/90">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Overview</h2>
            <p>
              RefundGuardian AI helps you organize order signals you choose to connect and highlights potential refund
              or compensation opportunities. This policy describes what we collect, how we use it, and your choices.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Data we process</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--foreground)]/85">
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
            <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--foreground)]/85">
              <li>Operate the service (show orders, opportunities, and account status).</li>
              <li>Security and abuse prevention.</li>
              <li>Support and troubleshooting upon request.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Your choices</h2>
            <p className="text-sm text-[var(--foreground)]/85">
              You can disconnect integrations you’ve linked and remove saved Gmail connection data from your account.
              For privacy requests, use the Support page.
            </p>
            <p className="text-sm text-[var(--muted)]">
              Need help? Use{' '}
              <Link href="/support" className="text-[var(--accent)] hover:underline">
                Support
              </Link>
              .
            </p>
          </section>
        </div>
        <Link href="/" className="mt-8 inline-block text-[var(--accent)] hover:underline">
          ← Back to home
        </Link>
      </main>
      <Footer />
    </>
  );
}
