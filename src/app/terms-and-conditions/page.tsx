// DEPLOY_SYNC — Paddle URL: /terms-and-conditions (overwrite 2026-04-11)
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms and Conditions | Refyndra',
  description: 'Terms and Conditions for Refyndra.',
};

export default function TermsAndConditionsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-zinc-100">
      <p className="text-sm text-zinc-400">Last updated: April 11, 2026</p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Terms and Conditions</h1>
      <p className="mt-6 leading-relaxed text-zinc-300">
        These Terms and Conditions (&quot;Terms&quot;) govern your access to and use of Refyndra&apos;s website and
        services. By using our services, you agree to these Terms.
      </p>

      <h2 className="mt-10 text-xl font-semibold">1. Service description</h2>
      <p className="mt-3 leading-relaxed text-zinc-300">
        Refyndra provides tools to help you track and pursue eligible compensation or refunds in line with merchant
        policies. We do not guarantee outcomes, amounts, or merchant responses.
      </p>

      <h2 className="mt-10 text-xl font-semibold">2. Accounts and eligibility</h2>
      <p className="mt-3 leading-relaxed text-zinc-300">
        You must provide accurate information, keep credentials secure, and comply with applicable laws and third-party
        terms (e.g. Amazon, Uber, DoorDash) when using the product.
      </p>

      <h2 className="mt-10 text-xl font-semibold">3. Subscriptions and billing</h2>
      <p className="mt-3 leading-relaxed text-zinc-300">
        Paid plans, trials, and renewals are processed by our billing provider (Paddle). Fees, taxes, and cancellation
        rules are shown at checkout and in your billing portal.
      </p>

      <h2 className="mt-10 text-xl font-semibold">4. Acceptable use</h2>
      <p className="mt-3 leading-relaxed text-zinc-300">
        You may not misuse the service, attempt unauthorized access, or use automation in violation of merchant or
        platform rules.
      </p>

      <h2 className="mt-10 text-xl font-semibold">5. Disclaimers</h2>
      <p className="mt-3 leading-relaxed text-zinc-300">
        The service is provided &quot;as is&quot; without warranties of any kind. Nothing on this site constitutes legal,
        tax, or financial advice.
      </p>

      <h2 className="mt-10 text-xl font-semibold">6. Limitation of liability</h2>
      <p className="mt-3 leading-relaxed text-zinc-300">
        To the fullest extent permitted by law, Refyndra and its suppliers will not be liable for indirect, incidental,
        special, consequential, or punitive damages.
      </p>

      <h2 className="mt-10 text-xl font-semibold">7. Changes</h2>
      <p className="mt-3 leading-relaxed text-zinc-300">
        We may update these Terms from time to time. Continued use after changes constitutes acceptance of the updated
        Terms.
      </p>

      <h2 className="mt-10 text-xl font-semibold">8. Contact</h2>
      <p className="mt-3 leading-relaxed text-zinc-300">
        For questions about these Terms, use the contact options listed on our website.
      </p>

      <p className="mt-12 text-sm text-zinc-500">
        <Link href="/" className="text-emerald-400 underline hover:text-emerald-300">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
