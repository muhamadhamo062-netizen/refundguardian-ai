import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pt-24 pb-20 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white">Contact</h1>
        <p className="mt-4 text-[var(--muted)]">
          For privacy and support requests, please use our in-app Support form.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/support"
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:bg-[var(--accent-muted)]"
          >
            Go to Support
          </Link>
          <Link href="/" className="self-center text-[var(--accent)] hover:underline">
            ← Back to home
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
