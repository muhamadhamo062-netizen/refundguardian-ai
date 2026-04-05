import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UpgradeScreen } from '@/components/upgrade/UpgradeScreen';
import type { UserBillingRow } from '@/lib/billing/plan';
import { isFreeTrialAiLocked, isProSubscriber } from '@/lib/billing/plan';

export const dynamic = 'force-dynamic';

export default async function UpgradePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: row } = await supabase
    .from('users')
    .select(
      'plan, subscription_status, trial_used, free_trial_initial_scan_completed_at, last_trial_scan_potential_cents, consent_given_at'
    )
    .eq('id', user.id)
    .maybeSingle();

  if (row && row.consent_given_at == null) {
    redirect('/consent');
  }

  const billing = (row ?? null) as UserBillingRow | null;

  if (isProSubscriber(billing)) {
    redirect('/dashboard');
  }

  if (!isFreeTrialAiLocked(billing)) {
    redirect('/dashboard');
  }

  const cents = billing?.last_trial_scan_potential_cents;
  const potentialUsd = typeof cents === 'number' ? cents / 100 : null;

  return <UpgradeScreen potentialUsd={potentialUsd} />;
}
