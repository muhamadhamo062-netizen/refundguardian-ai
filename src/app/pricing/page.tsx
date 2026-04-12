// DEPLOY_SYNC — Paddle URL: /pricing (overwrite 2026-04-11)
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing | Refyndra',
  description: 'Refyndra pricing overview.',
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-zinc-100">
      <h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
      <p className="mt-4 leading-relaxed text-zinc-300">
        Refyndra offers a free tier and optional paid plans. Exact prices, currency, and tax are shown in the app and at
        checkout. Billing for subscriptions is processed securely by Paddle (merchant of record where applicable).
      </p>

      <h2 className="mt-10 text-xl font-semibold">What affects what you pay</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed text-zinc-300">
        <li>Your region and applicable taxes</li>
        <li>Whether you choose monthly or annual billing</li>
        <li>Any active discounts shown at checkout</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold">Managing your subscription</h2>
      <p className="mt-3 leading-relaxed text-zinc-300">
        After purchase, you can manage billing, payment method, and cancellation through the customer portal linked from
        your Refyndra account when logged in.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Questions</h2>
      <p className="mt-3 leading-relaxed text-zinc-300">
        For plan details and feature limits, see the in-app pricing section or the marketing homepage. This page exists
        primarily so checkout and compliance URLs resolve with a clear 200 OK.
      </p>

      <p className="mt-12 text-sm text-zinc-500">
        <Link href="/" className="text-emerald-400 underline hover:text-emerald-300">
          ← Back to home
        </Link>
        {' · '}
        <Link href="/dashboard" className="text-emerald-400 underline hover:text-emerald-300">
          Dashboard
        </Link>
      </p>
    </div>
  );
}
