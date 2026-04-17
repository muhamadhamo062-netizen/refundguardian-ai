'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { openPaddleSubscriptionCheckout } from '@/lib/billing/paddleCheckoutClient';

const monthlyDisplay = process.env.NEXT_PUBLIC_PRO_MONTHLY_DISPLAY?.trim() || '$9/month';

export function PricingCheckoutSurface() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const activatePro = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        router.push('/auth?mode=signup&next=/pricing');
        return;
      }

      const res = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ interval: 'month' }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        provider?: string;
        checkout?: {
          priceId: string;
          customerEmail: string | null;
          customData: Record<string, string>;
        };
        error?: string;
      };
      if (!res.ok || body.ok !== true) {
        setErr(body.error || `Checkout unavailable (${res.status})`);
        return;
      }
      if (body.provider === 'paddle' && body.checkout) {
        await openPaddleSubscriptionCheckout(body.checkout);
        return;
      }
      setErr('Unexpected checkout response.');
    } finally {
      setBusy(false);
    }
  }, [router]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400/90">Refyndra Pro</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Turn delays into dollars</h1>
      <p className="mt-4 text-base leading-relaxed text-zinc-300">
        One plan — full Autonomous Compensation Engine, unlimited AI order scans, and priority workflows. Checkout is
        secure and powered by Paddle; tax and final price appear before you pay.
      </p>

      <div className="mt-8 rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/[0.12] to-[var(--card)]/90 p-6 shadow-[0_0_60px_-20px_rgba(16,185,129,0.45)] sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-400">Pro · billed monthly</p>
            <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-emerald-200 sm:text-5xl">{monthlyDisplay}</p>
            <p className="mt-2 text-sm text-zinc-400">Cancel anytime from your billing portal.</p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void activatePro()}
            className="inline-flex min-h-[52px] w-full touch-manipulation items-center justify-center rounded-xl bg-emerald-400 px-6 text-base font-semibold text-emerald-950 shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-300 disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
          >
            {busy ? 'Opening checkout…' : 'Activate Pro Now'}
          </button>
        </div>
        {err && <p className="mt-4 text-sm text-amber-200/95">{err}</p>}
        <p className="mt-6 border-t border-white/10 pt-4 text-xs text-zinc-500">
          New here?{' '}
          <Link href="/auth?mode=signup&next=/pricing" className="font-medium text-emerald-300 hover:text-emerald-200">
            Create a free account
          </Link>{' '}
          first — your subscription links to the same login.
        </p>
      </div>

      <p className="mt-8 text-sm leading-relaxed text-zinc-500">
        Annual billing may be available from your dashboard after you sign in. This page starts monthly checkout for
        the fastest path to Pro.
      </p>
    </div>
  );
}
