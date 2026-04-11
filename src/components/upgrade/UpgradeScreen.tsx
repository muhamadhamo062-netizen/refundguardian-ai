'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { signOut } from '@/app/actions/auth';
import { openPaddleSubscriptionCheckout } from '@/lib/billing/paddleCheckoutClient';

type Props = {
  potentialUsd: number | null;
};

/**
 * Post–free-scan conversion: Secure Checkout only; no silent billing.
 */
export function UpgradeScreen({ potentialUsd }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const checkout = useCallback(async (interval: 'month' | 'year') => {
    setBusy(interval);
    setErr(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setErr('Session expired. Sign in again.');
        return;
      }
      const res = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ interval: interval === 'year' ? 'year' : 'month' }),
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
        setErr(body.error || `Checkout unavailable (${res.status}). Configure Paddle env vars.`);
        return;
      }
      if (body.provider === 'paddle' && body.checkout) {
        await openPaddleSubscriptionCheckout(body.checkout);
        return;
      }
      setErr('Unexpected checkout response.');
    } finally {
      setBusy(null);
    }
  }, []);

  return (
    <div className="mx-auto max-w-lg text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">
        Free discovery complete
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
        Unlock full Refyndra AI
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
        Your one-time complimentary scan is finished. Further AI analysis and automation require an
        active Pro subscription — upgrade only through Secure Checkout (no surprise charges).
      </p>

      {potentialUsd != null && potentialUsd > 0 && (
        <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-6 ring-1 ring-emerald-500/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200/90">
            Potential recoverable (AI advisory estimate)
          </p>
          <p className="mt-2 text-4xl font-bold tabular-nums text-emerald-300">
            ${potentialUsd.toFixed(2)}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Estimates are not guaranteed. Pro unlocks ongoing scanning and full compensation automation.
          </p>
        </div>
      )}

      {potentialUsd != null && potentialUsd <= 0 && (
        <p className="mt-6 text-sm text-zinc-500">
          Your scan did not surface advisory refund estimates this round. Pro still unlocks unlimited
          monitoring and full AI features.
        </p>
      )}

      {err && (
        <p className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {err}
        </p>
      )}

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void checkout('month')}
          className="rounded-xl bg-[var(--accent)] px-8 py-3.5 text-sm font-semibold text-[#052e16] transition hover:opacity-95 disabled:opacity-50"
        >
          {busy === 'month' ? 'Redirecting…' : 'Subscribe — Pro monthly'}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void checkout('year')}
          className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-8 py-3.5 text-sm font-semibold text-white transition hover:border-emerald-500/40 disabled:opacity-50"
        >
          {busy === 'year' ? 'Redirecting…' : 'Pro annual'}
        </button>
      </div>

      <p className="mt-8 text-xs text-zinc-600">
        By continuing you start a paid subscription through Secure Checkout after you enter payment details —
        never billed without your consent on the secure checkout page.
      </p>

      <div className="mt-10 flex flex-col items-center gap-3 text-sm text-zinc-500">
        <Link href="/pricing" className="text-emerald-400/90 hover:underline">
          Compare plans
        </Link>
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-zinc-500 hover:text-zinc-300"
        >
          Sign out
        </button>
        <Link href="/" className="hover:text-zinc-300">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
