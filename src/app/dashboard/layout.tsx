import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { type UserBillingRow, isFreeTrialAiLocked, isProSubscriber } from '@/lib/billing/plan';

/** Lets the extension content script enable the dashboard bridge on any production domain in manifest. */
export const metadata: Metadata = {
  other: {
    'refundguardian-dashboard': '1',
  },
};

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('users')
    .select(
      'consent_given_at, trial_used, free_trial_initial_scan_completed_at, plan, subscription_status'
    )
    .eq('id', user.id)
    .maybeSingle();

  if (profile && profile.consent_given_at == null) {
    redirect('/consent');
  }

  const billing = profile as UserBillingRow | null;
  if (billing && !isProSubscriber(billing) && isFreeTrialAiLocked(billing)) {
    redirect('/upgrade');
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <DashboardNav />
      <main className="mx-auto w-full min-w-0 max-w-7xl overflow-x-hidden px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
