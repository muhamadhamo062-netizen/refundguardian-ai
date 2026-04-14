// PADDLE_VERIFICATION_V3
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing | Refyndra',
  description: 'Refyndra pricing and plans.',
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-zinc-100">
      <h1 className="text-3xl font-bold">Pricing</h1>
      <p className="mt-4 text-zinc-300 leading-relaxed">
        Refyndra offers free and paid plans. Final price, taxes, and billing intervals are shown at checkout.
      </p>
      <p className="mt-4 text-zinc-300 leading-relaxed">
        Subscription checkout and billing management are powered by Paddle.
      </p>
    </div>
  );
}
