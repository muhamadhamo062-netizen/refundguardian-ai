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
          Get in touch with our team.
        </p>
        <div className="mt-8 text-[var(--foreground)]/90">
          <p>This page is a placeholder. Add your contact form or email here.</p>
        </div>
        <Link href="/" className="mt-8 inline-block text-[var(--accent)] hover:underline">
          ← Back to home
        </Link>
      </main>
      <Footer />
    </>
  );
}
