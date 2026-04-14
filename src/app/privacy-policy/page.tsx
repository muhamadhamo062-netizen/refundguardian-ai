// PADDLE_VERIFICATION_V3
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Refyndra',
  description: 'Privacy Policy for Refyndra.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-zinc-100">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-4 text-zinc-300 leading-relaxed">
        We collect and process account and usage data needed to operate Refyndra, secure accounts, and improve product
        functionality. Billing and payment data are processed by Paddle for subscriptions where applicable.
      </p>
      <p className="mt-4 text-zinc-300 leading-relaxed">
        By using Refyndra, you acknowledge this policy and any updates posted on this page.
      </p>
    </div>
  );
}
