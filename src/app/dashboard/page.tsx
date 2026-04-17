import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { AmazonOrdersDashboard } from '@/components/dashboard/AmazonOrdersDashboard';
import { DashboardSyncScroll } from '@/components/dashboard/DashboardSyncScroll';
import { DashboardPlatformRecoveryCards } from '@/components/dashboard/DashboardPlatformRecoveryCards';
import { DashboardCommandCenterHero } from '@/components/dashboard/DashboardCommandCenterHero';
import { DashboardGrandTotalHeader } from '@/components/dashboard/DashboardGrandTotalHeader';
import { DashboardGmailPrimary } from '@/components/dashboard/DashboardGmailPrimary';
import { DashboardFreeTierBanner } from '@/components/dashboard/DashboardFreeTierBanner';
import { AiPriorityEngineTable } from '@/components/shared/AiPriorityEngineTable';
import { aggregateRefundCentsByPlatform, sumPlatformCents } from '@/lib/dashboard/platformRecovery';
import type { UserBillingRow } from '@/lib/billing/plan';
import { isFreeTrialAiLocked, isProSubscriber, maxAiOrdersForUser } from '@/lib/billing/plan';
import { createServiceRoleClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    notFound();
  }

  const uid = user.id;

  const [refundRowsRes, ordersCountRes, pendingClaimsRes, billingRes] = await Promise.all([
    supabase.from('refund_history').select('provider, amount_cents').eq('user_id', uid),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    supabase.from('claims').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'pending'),
    supabase
      .from('users')
      .select('plan, subscription_status, trial_used, autonomous_mode_enabled')
      .eq('id', uid)
      .maybeSingle(),
  ]);

  const refundRows = refundRowsRes.error ? [] : (refundRowsRes.data ?? []);
  const centsByPlatform = aggregateRefundCentsByPlatform(refundRows);
  const grandTotalCents = sumPlatformCents(centsByPlatform);

  const ordersScanned = ordersCountRes.error ? 0 : (ordersCountRes.count ?? 0);
  const pendingClaims = pendingClaimsRes.error ? 0 : (pendingClaimsRes.count ?? 0);

  const billing = (billingRes.data ?? null) as UserBillingRow | null;
  const isPro = isProSubscriber(billing);
  const trialLocked = isFreeTrialAiLocked(billing);
  const aiBatchLimit = maxAiOrdersForUser(billing);
  const serverAutonomous = Boolean(billing?.autonomous_mode_enabled);

  let globalUserCount: number | null = null;
  const admin = createServiceRoleClient();
  if (admin) {
    const { count, error } = await admin.from('users').select('id', { count: 'exact', head: true });
    if (!error && typeof count === 'number') {
      globalUserCount = count;
    }
  }

  return (
    <div className="flex min-h-screen w-full min-w-0 max-w-none flex-col bg-[var(--background)]">
      <DashboardSyncScroll />

      <DashboardFreeTierBanner isPro={isPro} trialUsed={Boolean(billing?.trial_used)} />

      <DashboardCommandCenterHero />

      <DashboardGrandTotalHeader
        grandTotalCents={grandTotalCents}
        ordersScanned={ordersScanned}
        pendingClaims={pendingClaims}
        globalUserCount={globalUserCount}
      />

      <DashboardGmailPrimary />

      <section className="relative z-10 mt-8 w-full min-w-0" aria-labelledby="ai-priority-heading">
        <h2 id="ai-priority-heading" className="sr-only">
          AI Priority Engine
        </h2>
        <AiPriorityEngineTable slimDashboard className="w-full" />
      </section>

      <section
        id="dashboard-orders"
        className="relative z-10 mt-10 w-full min-w-0 flex-1 scroll-mt-24"
        aria-labelledby="orders-heading"
      >
        <h2 id="orders-heading" className="sr-only">
          Orders
        </h2>
        <div className="w-full max-w-none">
          <AmazonOrdersDashboard
            isPro={isPro}
            trialScanLocked={trialLocked}
            maxAiOrdersPerBatch={aiBatchLimit}
            serverAutonomousMode={serverAutonomous}
          />
        </div>
      </section>

      <DashboardPlatformRecoveryCards centsByPlatform={centsByPlatform} variant="footer" />
    </div>
  );
}
