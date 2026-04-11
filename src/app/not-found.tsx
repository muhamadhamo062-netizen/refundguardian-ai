import type { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-lg flex-col items-center justify-center px-4 pb-24 pt-28 text-center sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400/90">404</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {`Oops! You're lost, but your refunds aren't.`}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
          The page you&apos;re looking for doesn&apos;t exist or was moved. Head back to your dashboard to keep
          tracking recoveries.
        </p>
        <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-8 py-3.5 text-sm font-semibold text-[var(--background)] shadow-lg shadow-emerald-950/40 transition-all hover:bg-[var(--accent-muted)] hover:scale-[1.02]"
          >
            Back to Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:border-emerald-500/40 hover:text-[var(--accent)]"
          >
            Back to home
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
