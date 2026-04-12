// DEPLOY_SYNC — Paddle URL: /privacy-policy (overwrite 2026-04-11)
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | Refyndra',
  description: 'Privacy Policy for Refyndra.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-zinc-100">
      <p className="text-sm text-zinc-400">Last updated: April 11, 2026</p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-6 leading-relaxed text-zinc-300">
        This Privacy Policy explains how Refyndra collects, uses, and shares information when you use our website and
        services.
      </p>

      <h2 className="mt-10 text-xl font-semibold">1. Information we collect</h2>
      <p className="mt-3 leading-relaxed text-zinc-300">
        We may collect account and authentication data (e.g. email), usage data, device and log data, and information you
        choose to provide (such as connected accounts or order-related details you submit to use features).
      </p>

      <h2 className="mt-10 text-xl font-semibold">2. How we use information</h2>
      <p className="mt-3 leading-relaxed text-zinc-300">
        We use information to provide and improve the service, secure accounts, communicate with you, comply with law,
        and process subscriptions through our payment partner.
      </p>

      <h2 className="mt-10 text-xl font-semibold">3. Sharing</h2>
      <p className="mt-3 leading-relaxed text-zinc-300">
        We may share information with service providers (e.g. hosting, auth, email, billing) who process data on our
        instructions, and when required by law. Billing is handled by Paddle as merchant of record for applicable
        purchases.
      </p>

      <h2 className="mt-10 text-xl font-semibold">4. Retention</h2>
      <p className="mt-3 leading-relaxed text-zinc-300">
        We retain information for as long as needed to provide the service, meet legal obligations, resolve disputes, and
        enforce agreements.
      </p>

      <h2 className="mt-10 text-xl font-semibold">5. Security</h2>
      <p className="mt-3 leading-relaxed text-zinc-300">
        We implement appropriate technical and organizational measures to protect information. No method of transmission
        or storage is 100% secure.
      </p>

      <h2 className="mt-10 text-xl font-semibold">6. Your choices</h2>
      <p className="mt-3 leading-relaxed text-zinc-300">
        Depending on your region, you may have rights to access, correct, delete, or export personal data, or to object to
        certain processing. Contact us to exercise applicable rights.
      </p>

      <h2 className="mt-10 text-xl font-semibold">7. International transfers</h2>
      <p className="mt-3 leading-relaxed text-zinc-300">
        If you use the service from outside the country where we operate servers, your information may be transferred and
        processed in other countries.
      </p>

      <h2 className="mt-10 text-xl font-semibold">8. Children</h2>
      <p className="mt-3 leading-relaxed text-zinc-300">
        The service is not directed to children under the age where parental consent is required for data collection in
        your jurisdiction.
      </p>

      <h2 className="mt-10 text-xl font-semibold">9. Changes</h2>
      <p className="mt-3 leading-relaxed text-zinc-300">
        We may update this policy from time to time. We will post the updated version on this page with a new &quot;Last
        updated&quot; date.
      </p>

      <p className="mt-12 text-sm text-zinc-500">
        <Link href="/" className="text-emerald-400 underline hover:text-emerald-300">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
