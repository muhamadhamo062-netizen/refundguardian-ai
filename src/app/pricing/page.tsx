// PADDLE_VERIFICATION_V3
import type { Metadata } from 'next';
import { PricingCheckoutSurface } from './PricingCheckoutSurface';

export const metadata: Metadata = {
  title: 'Pricing | Refyndra',
  description: 'Activate Refyndra Pro — unlimited AI scans and autonomous compensation workflows.',
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-zinc-100 antialiased">
      <PricingCheckoutSurface />
    </div>
  );
}
