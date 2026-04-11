'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserBillingRow } from '@/lib/billing/plan';
import {
  isFreeTrialAiLocked,
  isProSubscriber,
  isTrialWindowOpen,
  planLabel,
  trialDaysRemaining,
} from '@/lib/billing/plan';
import { openPaddleSubscriptionCheckout } from '@/lib/billing/paddleCheckoutClient';

type Props = {
  initialProfile: UserBillingRow | null;
};

export function SubscriptionStatusBar({ initialProfile }: Props) {
  const [profile, setProfile] = useState<UserBillingRow | null>(initialProfile);

  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);
  const [busy, setBusy] = useState<string | null>(null);
  const [autoErr, setAutoErr] = useState<string | null>(null);

  const pro = isProSubscriber(profile);
  const trial = isTrialWindowOpen(profile);
  const label = planLabel(profile);
  const trialScanDone = isFreeTrialAiLocked(profile);

  const refreshProfile = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const res = await fetch('/api/user/billing', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      profile?: UserBillingRow;
    };
    if (body.ok && body.profile) setProfile(body.profile);
  }, []);

  const startCheckout = useCallback(
    async (interval: 'month' | 'year') => {
      setBusy('checkout');
      setAutoErr(null);
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;
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
          setAutoErr(body.error || `Checkout unavailable (${res.status})`);
          return;
        }
        if (body.provider === 'paddle' && body.checkout) {
          await openPaddleSubscriptionCheckout(body.checkout);
          return;
        }
        setAutoErr('Unexpected checkout response.');
      } finally {
        setBusy(null);
      }
    },
    []
  );

  const openPortal = useCallback(async () => {
    setBusy('portal');
    setAutoErr(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || body.ok !== true || !body.url) {
        setAutoErr(body.error || 'Billing portal unavailable');
        return;
      }
      window.location.href = body.url;
    } finally {
      setBusy(null);
    }
  }, []);

  const toggleAutonomous = useCallback(
    async (enabled: boolean) => {
      if (!pro) return;
      setBusy('auto');
      setAutoErr(null);
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;
        const res = await fetch('/api/user/autonomous', {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ autonomous_mode_enabled: enabled }),
        });
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || body.ok !== true) {
          setAutoErr(body.error || 'Could not update automation');
          return;
        }
        await refreshProfile();
      } finally {
        setBusy(null);
      }
    },
    [pro, refreshProfile]
  );

  const trialEnds =
    profile?.trial_ends_at && trial
      ? new Date(profile.trial_ends_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null;

  const trialDays = trial ? trialDaysRemaining(profile) : null;

  return (
    <section className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--card)]/90 p-4 shadow-lg shadow-black/20 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Plan & billing
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-200 ring-1 ring-emerald-500/30">
              {label}
            </span>
            {trial && trialEnds && (
              <span className="text-xs text-zinc-400">
                {typeof trialDays === 'number' ? (
                  <>
                    <span className="font-medium text-zinc-300">{trialDays} day{trialDays === 1 ? '' : 's'} left</span>
                    {' · '}
                  </>
                ) : null}
                Trial access until {trialEnds}
              </span>
            )}
            {pro && (
              <span className="block text-xs text-zinc-500">
                Renewal & invoices: open{' '}
                <strong className="font-medium text-zinc-400">Manage subscription</strong> — your billing portal shows the
                next charge date and usage.
              </span>
            )}
            {!pro && (
              <span className="text-xs text-zinc-500">
                Free trial includes one smart scan on recent orders · No charge until you subscribe
              </span>
            )}
            {!pro && trialScanDone && (
              <span className="block text-xs text-amber-200/95">
                Complimentary AI scan used — upgrade to Pro for unlimited scanning and automation.
              </span>
            )}
          </div>
          {autoErr && (
            <p className="mt-2 text-xs text-amber-300/95">{autoErr}</p>
          )}
        </div>

        <div className="flex w-full min-w-0 flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          {!pro && (
            <>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void startCheckout('month')}
                className="min-h-[44px] w-full touch-manipulation rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[#052e16] transition hover:opacity-90 disabled:opacity-50 sm:w-auto"
              >
                {busy === 'checkout' ? 'Redirecting…' : 'Upgrade to Pro (monthly)'}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void startCheckout('year')}
                className="min-h-[44px] w-full touch-manipulation rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm font-medium text-white transition hover:border-emerald-500/40 disabled:opacity-50 sm:w-auto"
              >
                Pro (annual)
              </button>
            </>
          )}
          {pro && profile?.paddle_customer_id && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void openPortal()}
              className="min-h-[44px] w-full touch-manipulation rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-zinc-200 hover:border-emerald-500/40 sm:w-auto"
            >
              {busy === 'portal' ? 'Opening…' : 'Manage subscription'}
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 border-t border-[var(--border)] pt-4">
        <label className="flex cursor-pointer flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-sm font-medium text-white">AI Auto-Pilot</span>
            <p className="mt-0.5 text-xs text-zinc-500">
              Pro only. When on, Refyndra tracks eligible activity in the background to support your drafts — you stay in
              control; nothing is sent to merchants without you.
            </p>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4 cursor-pointer rounded border-[var(--border)] accent-[var(--accent)] disabled:opacity-40"
            checked={Boolean(profile?.autonomous_mode_enabled)}
            disabled={!pro || busy !== null}
            onChange={(e) => void toggleAutonomous(e.target.checked)}
          />
        </label>
        {!pro && (
          <p className="mt-2 text-[10px] text-zinc-600">Upgrade to Pro to turn on AI Auto-Pilot.</p>
        )}
      </div>
    </section>
  );
}
