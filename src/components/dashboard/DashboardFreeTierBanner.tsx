import Link from 'next/link';

type Props = {
  isPro: boolean;
  trialUsed: boolean;
};

/** Top-of-dashboard upsell for non‑Pro accounts (complimentary claim + Pro unlock). */
export function DashboardFreeTierBanner({ isPro, trialUsed }: Props) {
  if (isPro) return null;

  return (
    <div
      className="mb-6 rounded-xl border border-amber-500/35 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-50 shadow-[0_0_40px_-12px_rgba(245,158,11,0.35)] sm:px-5"
      role="status"
    >
      {!trialUsed ? (
        <p className="leading-relaxed">
          <span className="font-semibold text-amber-100">1 Free AI Claim remaining.</span>{' '}
          Unlock 50+ more with Pro.{' '}
          <Link href="/pricing" className="font-semibold text-emerald-300 underline decoration-emerald-500/50 underline-offset-2 hover:text-emerald-200">
            View Pro plans
          </Link>
        </p>
      ) : (
        <p className="leading-relaxed">
          <span className="font-semibold text-amber-100">Your complimentary AI claim is used.</span>{' '}
          Upgrade to Pro for unlimited scans and automation.{' '}
          <Link href="/pricing" className="font-semibold text-emerald-300 underline decoration-emerald-500/50 underline-offset-2 hover:text-emerald-200">
            Activate Pro
          </Link>
        </p>
      )}
    </div>
  );
}
