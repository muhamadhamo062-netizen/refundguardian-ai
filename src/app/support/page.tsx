import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/supportContact';
import { SupportForm } from './supportForm';

export const dynamic = 'force-dynamic';

export default function SupportPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pt-24 pb-20 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white">Support</h1>
        <p className="mt-4 text-[var(--muted)]">
          Tell us what you’re stuck on. We’ll get back to you within <strong className="text-zinc-200">24–48 hours</strong>.
        </p>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Prefer email? Reach us at{' '}
          <a href={SUPPORT_MAILTO} className="font-medium text-[var(--accent)] hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
        <div className="mt-10">
          <SupportForm />
        </div>
      </main>
      <Footer />
    </>
  );
}

