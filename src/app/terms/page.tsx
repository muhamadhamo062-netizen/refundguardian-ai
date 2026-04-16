import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pt-24 pb-20 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
        <p className="mt-4 text-[var(--muted)]">
          Last updated: {new Date().toLocaleDateString()}
        </p>
        <div className="mt-8 space-y-4 text-[var(--foreground)]/90">
          <p>
            By using RefundGuardian AI, you agree to use the product only for lawful purposes and in line with
            each merchant&apos;s terms. The service provides tools and estimates; outcomes depend on merchants
            and your own follow-up.
          </p>
          <p>
            You are responsible for keeping your account credentials secure. We may update these terms; continued use
            after changes constitutes acceptance.
          </p>
          <p className="text-sm text-[var(--muted)]">
            Nothing on this site constitutes legal, tax, or financial advice. Replace the support email
            domain with your production address before launch if different.
          </p>
        </div>
        <Link href="/" className="mt-8 inline-block text-[var(--accent)] hover:underline">
          ← Back to home
        </Link>
      </main>
      <Footer />
    </>
  );
}
