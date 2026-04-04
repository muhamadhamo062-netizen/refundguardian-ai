import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export const dynamic = 'force-dynamic';

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pt-24 pb-20 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white">About RefundGuardian AI</h1>
        <p className="mt-4 text-[var(--muted)]">
          RefundGuardian AI helps you automatically spot missed refunds and compensation opportunities — turning
          overlooked issues into potential savings you may be owed.
        </p>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Results vary by merchant policies and account history.
        </p>

        <div className="mt-10 space-y-6 text-[var(--foreground)]/90">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">What we do</h2>
            <p>
              We organize the order signals you choose to connect (desktop extension) and optional email-based
              scanning (mobile) to highlight where you may be owed money. We then generate clear, audit-friendly
              details and guidance so you can take action quickly.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">What we don’t do</h2>
            <p>
              We are not a bank, not a law firm, and we do not guarantee outcomes from any merchant. Refunds and
              compensation depend on each platform’s policies and your account history.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Privacy & security</h2>
            <p>
              We minimize data collection and use secure infrastructure. If you connect Gmail using an App Password,
              it’s encrypted on the server before storage.
            </p>
            <p className="text-sm text-[var(--muted)]">
              See our <Link href="/privacy" className="text-[var(--accent)] hover:underline">Privacy Policy</Link>.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/support"
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:bg-[var(--accent-muted)]"
          >
            Contact Support
          </Link>
          <Link href="/" className="text-[var(--accent)] hover:underline self-center">
            ← Back to home
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}

