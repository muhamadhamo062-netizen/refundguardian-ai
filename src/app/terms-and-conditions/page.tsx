// PADDLE_VERIFICATION_V3
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms and Conditions | Refyndra',
  description: 'Terms and Conditions for Refyndra.',
};

export default function TermsAndConditionsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-zinc-100">
      <h1 className="text-3xl font-bold">Terms and Conditions</h1>
      <p className="mt-4 text-zinc-300 leading-relaxed">
        These Terms govern your use of Refyndra services. By using Refyndra, you agree to these terms. We provide
        software tools to help users identify potential compensation opportunities, but we do not guarantee results.
      </p>
      <p className="mt-4 text-zinc-300 leading-relaxed">
        Subscription billing, renewals, and cancellations are handled through Paddle where applicable.
      </p>
    </div>
  );
}
