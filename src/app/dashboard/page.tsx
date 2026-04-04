import { createClient } from '@/lib/supabase/server';
import { AnimatedCounter } from '@/components/dashboard/AnimatedCounter';
import { MonitorCard } from '@/components/dashboard/MonitorCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { RefundHistoryTable } from '@/components/dashboard/RefundHistoryTable';
import { ScanButton } from '@/components/dashboard/ScanButton';
import { RecoveredRefundOpportunities } from '@/components/dashboard/RecoveredRefundOpportunities';
import { ConnectionSetupSection } from '@/components/dashboard/ConnectionSetupSection';
import { AmazonOrdersDashboard } from '@/components/dashboard/AmazonOrdersDashboard';
import { SubscriptionStatusBar } from '@/components/dashboard/SubscriptionStatusBar';
import { FirstRecoveryBanner } from '@/components/dashboard/FirstRecoveryBanner';
import { CompensationPipelineCard } from '@/components/dashboard/CompensationPipelineCard';
import type { UserBillingRow } from '@/lib/billing/plan';
import { isFreeTrialAiLocked, isProSubscriber, maxAiOrdersForUser } from '@/lib/billing/plan';
import { buildActivityFeedItems } from '@/lib/dashboard/buildActivityFeedItems';
import { isExtensionSyncTableMissingError } from '@/lib/supabase/dbErrors';
import { Migration014Banner } from '@/components/dashboard/Migration014Banner';
import { DashboardHealthStrip } from '@/components/dashboard/DashboardHealthStrip';
import { AiPriorityEngineTable } from '@/components/shared/AiPriorityEngineTable';
import { Deferred } from '@/components/shared/Deferred';

export const dynamic = 'force-dynamic';

function DeliveryIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}

function RideIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function OrderIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: billingRow } = user
    ? await supabase
        .from('users')
        .select(
          'plan, subscription_status, trial_ends_at, autonomous_mode_enabled, stripe_customer_id, stripe_subscription_id, free_trial_initial_scan_completed_at, trial_used, last_trial_scan_potential_cents'
        )
        .eq('id', user.id)
        .maybeSingle()
    : { data: null };

  const billingProfile: UserBillingRow | null = billingRow;

  const uid = user?.id;

  const [
    mainData,
    orderCountsData,
  ] = await Promise.all([
    Promise.all([
      supabase
        .from('refund_history')
        .select('id, amount_cents, currency, provider, completed_at')
        .order('completed_at', { ascending: false })
        .limit(50),
      supabase
        .from('receipts')
        .select('id, source, order_id, status, amount_cents, currency, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('claims')
        .select('id, status, amount_cents, currency, created_at, provider')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('detected_refunds')
        .select(
          'id, created_at, potential_refund_cents, currency, status, delay_minutes, orders(merchant_name, order_date)'
        )
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('orders')
        .select('id, merchant_name, order_id, provider, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('extension_sync_events')
        .select('id, event_type, order_count, created_at')
        .order('created_at', { ascending: false })
        .limit(15),
    ]),
    uid
      ? Promise.all([
          supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', uid)
            .eq('provider', 'amazon'),
          supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', uid)
            .eq('provider', 'uber'),
          supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', uid)
            .in('provider', ['uber_eats', 'doordash', 'other']),
        ])
      : Promise.resolve([
          { count: 0 as number | null },
          { count: 0 as number | null },
          { count: 0 as number | null },
        ]),
  ]);

  const [
    { data: refunds },
    { data: receipts },
    { data: claims },
    { data: opportunities },
    { data: recentOrders },
    { data: extensionSyncs },
  ] = mainData;

  const [deliveryOrderCountRes, rideOrderCountRes, foodOrderCountRes] = orderCountsData;
  const deliveryOrderCount = deliveryOrderCountRes.count ?? 0;
  const rideOrderCount = rideOrderCountRes.count ?? 0;
  const foodOrderCount = foodOrderCountRes.count ?? 0;

  const safeRefunds = refunds ?? [];
  const safeReceipts = receipts ?? [];
  const safeClaims = claims ?? [];
  const safeOpportunities = (opportunities ?? []).map((o) => {
    const orders = o.orders as { merchant_name: string | null; order_date: string | null }[];
    return {
      id: o.id,
      merchant_name: orders?.[0]?.merchant_name ?? null,
      order_date: orders?.[0]?.order_date ?? null,
      potential_refund_cents: o.potential_refund_cents,
      currency: o.currency,
      status: o.status as 'open' | 'claimed' | 'refunded' | 'dismissed',
      delay_minutes: o.delay_minutes,
      created_at:
        typeof (o as { created_at?: string }).created_at === 'string'
          ? (o as { created_at: string }).created_at
          : '',
    };
  });

  const totalRecoveredCents = safeRefunds.reduce(
    (sum, r) => sum + (r.amount_cents ?? 0),
    0
  );
  const totalRecovered = totalRecoveredCents / 100;

  const pendingClaimsCount = safeClaims.filter((c) => c.status === 'pending').length;
  const submittedClaimsCount = safeClaims.filter((c) => c.status === 'submitted').length;

  // Category breakdown for monitor cards (delivery = Amazon, ride = Uber, order = food / other)
  const deliveryReceipts = safeReceipts.filter((r) => r.source === 'amazon');
  const rideReceipts = safeReceipts.filter((r) => r.source === 'uber_ride');
  const orderReceipts = safeReceipts.filter(
    (r) => r.source === 'uber_eats' || r.source === 'other'
  );

  const providerLower = (p: string | null | undefined) => (p ?? '').toLowerCase();
  const deliveryRefunds = safeRefunds.filter((r) =>
    providerLower(r.provider).includes('amazon')
  );
  const rideRefunds = safeRefunds.filter((r) =>
    providerLower(r.provider).includes('uber') && !providerLower(r.provider).includes('eats')
  );
  const orderRefunds = safeRefunds.filter(
    (r) =>
      providerLower(r.provider).includes('eats') ||
      providerLower(r.provider).includes('doordash') ||
      providerLower(r.provider).includes('food')
  );

  const deliveryClaims = safeClaims.filter((c) =>
    providerLower((c as { provider?: string }).provider).includes('amazon')
  );
  const rideClaims = safeClaims.filter((c) => {
    const p = providerLower((c as { provider?: string }).provider);
    return p.includes('uber') && !p.includes('eats');
  });
  const orderClaims = safeClaims.filter((c) => {
    const p = providerLower((c as { provider?: string }).provider);
    return p.includes('eats') || p.includes('doordash') || p.includes('food');
  });

  /** Extension + IMAP write to `orders`; legacy email flow may only fill `receipts`. Use the higher of the two so the first client sees real “orders scanned” counts. */
  const deliveryOrdersScanned = Math.max(deliveryReceipts.length, deliveryOrderCount);
  const rideOrdersScanned = Math.max(rideReceipts.length, rideOrderCount);
  const orderCompOrdersScanned = Math.max(orderReceipts.length, foodOrderCount);

  const ordersForFeed = (recentOrders ?? []).filter((o) => {
    const oid = o.order_id != null ? String(o.order_id) : '';
    if (oid.startsWith('rg-seed-')) return false;
    if (String(o.merchant_name || '').includes('Welcome — connect')) return false;
    return true;
  });

  const activityItems = buildActivityFeedItems({
    orders: ordersForFeed,
    receipts: safeReceipts.slice(0, 25),
    claims: safeClaims.slice(0, 25),
    refunds: safeRefunds.slice(0, 15),
    opportunities: safeOpportunities.map((o) => ({
      id: o.id,
      merchant_name: o.merchant_name,
      delay_minutes: o.delay_minutes,
      created_at: o.created_at,
    })),
    extensionSyncs: extensionSyncs ?? [],
  });

  const refundHistoryRows = safeRefunds.map((r) => ({
    id: r.id,
    provider: r.provider ?? '—',
    amount_cents: r.amount_cents ?? 0,
    currency: r.currency,
    completed_at: r.completed_at,
    status: 'Completed',
  }));

  const isPro = isProSubscriber(billingProfile);

  const { error: extSyncProbeErr } = await supabase
    .from('extension_sync_events')
    .select('id')
    .limit(1);
  const migration014Missing = !!(
    extSyncProbeErr && isExtensionSyncTableMissingError(extSyncProbeErr)
  );

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-[var(--background)]">
      <div className="mb-4 space-y-3">
        <Migration014Banner show={migration014Missing} />
        <DashboardHealthStrip />
      </div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Outcomes, insights, and activity
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-stretch gap-3 sm:w-auto sm:items-center sm:justify-end">
          <ScanButton />
        </div>
      </div>

      {user ? (
        <div className="mt-5">
          <FirstRecoveryBanner
            userId={user.id}
            totalCents={totalRecoveredCents}
            refundCount={safeRefunds.length}
            isPro={isPro}
          />
        </div>
      ) : null}

      <section className="mt-6" aria-labelledby="dashboard-setup-heading">
        <h2 id="dashboard-setup-heading" className="sr-only">
          Connect orders — extension or Gmail
        </h2>
        <p className="mb-2 text-xs font-medium text-zinc-400">
          On <strong className="font-semibold text-zinc-300">mobile</strong>, connect Gmail with an App Password. On{' '}
          <strong className="font-semibold text-zinc-300">desktop</strong>, use the Chrome extension. Both save under your
          same account so orders stay in one place.
        </p>
        <ConnectionSetupSection variant="dashboard" />
      </section>

      <Deferred>
        <CompensationPipelineCard />
      </Deferred>

      <div id="plan">
        <Deferred>
          <SubscriptionStatusBar initialProfile={billingProfile} />
        </Deferred>
      </div>

      <section className="mt-8 sm:mt-10">
        <Deferred>
          <AiPriorityEngineTable />
        </Deferred>
      </section>

      <section className="mt-6 grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)]/60 px-4 py-4 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">In progress</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-200">{pendingClaimsCount}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Agent processed</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-violet-200">{submittedClaimsCount}</p>
        </div>
      </section>

      <Deferred
        fallback={
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--muted)]">
            Loading orders…
          </div>
        }
      >
        <AmazonOrdersDashboard
          maxAiOrdersPerBatch={maxAiOrdersForUser(billingProfile)}
          isPro={isPro}
          serverAutonomousMode={Boolean(billingProfile?.autonomous_mode_enabled)}
          trialScanLocked={isFreeTrialAiLocked(billingProfile)}
        />
      </Deferred>

      {/* Total Refunds Recovered — KPI strip */}
      <section className="mt-8 sm:mt-10">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-[#0a0c10] p-6 shadow-2xl shadow-black/30 sm:p-8 md:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,var(--accent)/8%,transparent)]" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Total Compensation Recovered
            </p>
            <p className="mt-3 text-4xl font-bold tabular-nums text-[var(--accent)] drop-shadow-sm sm:text-5xl md:text-6xl lg:text-7xl">
              <AnimatedCounter
                value={totalRecovered}
                prefix="$"
                decimals={0}
                duration={1800}
              />
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              All time · RefundRadar AI
            </p>
          </div>
        </div>
      </section>

      {/* 3 Monitoring cards */}
      <section className="mt-8 sm:mt-10">
        <div className="grid gap-5 sm:gap-6 md:grid-cols-3">
          <MonitorCard
            title="Delivery Delay Monitor"
            icon={<DeliveryIcon />}
            ordersScanned={deliveryOrdersScanned}
            claimsSubmitted={deliveryClaims.length}
            refundsRecovered={deliveryRefunds.length}
            accentColor="emerald"
          />
          <MonitorCard
            title="Ride Delay Monitor"
            icon={<RideIcon />}
            ordersScanned={rideOrdersScanned}
            claimsSubmitted={rideClaims.length}
            refundsRecovered={rideRefunds.length}
            accentColor="amber"
          />
          <MonitorCard
            title="Order Compensation Monitor"
            icon={<OrderIcon />}
            ordersScanned={orderCompOrdersScanned}
            claimsSubmitted={orderClaims.length}
            refundsRecovered={orderRefunds.length}
            accentColor="violet"
          />
        </div>
      </section>

      {/* Recovered Refund Opportunities */}
      <section className="mt-8 sm:mt-10">
        <RecoveredRefundOpportunities items={safeOpportunities} />
      </section>

      {/* Activity Feed + Refund History side by side (stack on mobile) */}
      <section className="mt-8 grid gap-6 sm:mt-10 lg:grid-cols-2">
        <ActivityFeed items={activityItems} />
        <RefundHistoryTable rows={refundHistoryRows} maxRows={10} />
      </section>
    </div>
  );
}
