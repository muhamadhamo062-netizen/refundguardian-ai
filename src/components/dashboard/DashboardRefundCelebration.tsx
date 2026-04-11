'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { mergeFieldsFromNotificationData } from '@/lib/email/refundSuccessTemplates';
import { isProSubscriber } from '@/lib/billing/plan';
import type { UserBillingRow } from '@/lib/billing/plan';
import { DEFAULT_SITE_ORIGIN } from '@/lib/siteUrl';
import { isNotificationsTableMissingError } from '@/lib/supabase/dbErrors';

type NotifRow = {
  id: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
};

/**
 * Next dashboard visit after an order moves to `refunded`: show celebration + upgrade CTA.
 * Email is sent by `/api/cron/refund-notification-emails` (Resend).
 */
export function DashboardRefundCelebration() {
  const [open, setOpen] = useState(false);
  const [row, setRow] = useState<NotifRow | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [notifFetch, setNotifFetch] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  const siteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}`
      : process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_ORIGIN;

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    void (async () => {
      try {
        setNotifFetch('loading');
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setNotifFetch('ready');
          return;
        }

        const { data: profile } = await supabase
          .from('users')
          .select('plan, subscription_status')
          .eq('id', session.user.id)
          .maybeSingle();
        if (!cancelled && profile) {
          setIsPro(isProSubscriber(profile as UserBillingRow));
        }

        const { data: n, error } = await supabase
          .from('notifications')
          .select('id, title, body, data, created_at')
          .eq('type', 'refund_success_upgrade')
          .is('read_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          if (isNotificationsTableMissingError(error)) {
            setNotifFetch('unavailable');
            return;
          }
          setNotifFetch('ready');
          return;
        }
        if (!n) {
          setNotifFetch('ready');
          return;
        }
        setRow(n as NotifRow);
        setOpen(true);
        setNotifFetch('ready');
      } catch {
        setNotifFetch('unavailable');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const onDismiss = useCallback(async () => {
    if (!row) return;
    setDismissing(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', row.id);
    if (error && !isNotificationsTableMissingError(error)) {
      /* table exists but update failed — still close UI */
    }
    setOpen(false);
    setRow(null);
    setDismissing(false);
  }, [row]);

  if (notifFetch !== 'ready') {
    return null;
  }

  if (!open || !row) return null;

  const merge = mergeFieldsFromNotificationData(row.data, siteUrl);
  if (!merge) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="refund-celebration-title"
    >
      <div className="flex max-h-[min(92dvh,100%)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-emerald-500/30 bg-[var(--card)] shadow-2xl shadow-emerald-950/40 sm:rounded-2xl">
        <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-4 sm:px-6">
          <p id="refund-celebration-title" className="text-lg font-semibold text-emerald-100">
            {row.title}
          </p>
          <p className="mt-1 text-sm text-emerald-200/80">Money back confirmed — Refyndra AI</p>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm leading-relaxed text-zinc-200 sm:px-6">
          <p>
            Hi <strong className="text-white">{merge.userDisplayName}</strong>,
          </p>
          <p>
            Check your <strong className="text-white">{merge.platformLabel}</strong> account right now! 💰 We just
            confirmed that your <strong className="text-white">{merge.amountFormatted}</strong> refund is officially back
            in your balance.
          </p>
          <p className="text-zinc-400">
            We got you this one for free to show you the power of Refyndra AI. Your money shouldn&apos;t be lost as long
            as Refyndra is watching your back.
          </p>
          {!isPro ? (
            <>
              <p className="font-medium text-zinc-200">Upgrade to Pro:</p>
              <ul className="list-inside list-disc space-y-1 text-zinc-300">
                <li>
                  Monthly Pro: <strong>{merge.monthlyPriceDisplay}</strong> — so this subscription literally pays for
                  itself!*
                </li>
                <li>
                  Annual (best value): <strong>{merge.annualPriceDisplay}</strong> — Save 25%!
                </li>
              </ul>
              <p className="text-xs text-zinc-500">
                *Outcomes depend on merchant policies; not a guarantee of future refunds.
              </p>
            </>
          ) : (
            <p className="text-zinc-400">
              You&apos;re on Pro — keep Refyndra connected for ongoing monitoring.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 border-t border-[var(--border)] px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
          {!isPro ? (
            <Link
              href="/upgrade"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--background)]"
            >
              Upgrade to Pro
            </Link>
          ) : (
            <Link
              href="/dashboard/refund-history"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-100"
            >
              View refund history
            </Link>
          )}
          <button
            type="button"
            onClick={() => void onDismiss()}
            disabled={dismissing}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 text-sm font-medium text-zinc-200"
          >
            {dismissing ? 'Saving…' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
