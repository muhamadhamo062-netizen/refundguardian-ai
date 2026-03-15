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
        <div className="mt-8 prose prose-invert max-w-none">
          <p className="text-[var(--foreground)]/90">
            Your privacy is important to us. This page is a placeholder. Please add your privacy policy content here.
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
