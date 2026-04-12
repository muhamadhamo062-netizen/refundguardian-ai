import { createClient } from '@/lib/supabase/server';
import { MonitorCard } from '@/components/dashboard/MonitorCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { RefundStatusCards, type RefundStatusCardRow } from '@/components/dashboard/RefundStatusCards';
import { TotalRecoveredHero } from '@/components/dashboard/TotalRecoveredHero';
import { LockedCompensationCard } from '@/components/dashboard/LockedCompensationCard';
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
          'plan, subscription_status, trial_ends_at, autonomous_mode_enabled, paddle_customer_id, paddle_subscription_id, free_trial_initial_scan_completed_at, trial_used, last_trial_scan_potential_cents'
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
          'id, created_at, potential_refund_cents, currency, status, delay_minutes, orders(merchant_name, order_date, provider)'
        )
        .order('created_at', { ascending: false })
        .limit(20),
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
      uid
        ? supabase
            .from('orders')
            .select('refund_amount_cents, order_value_cents')
            .eq('user_id', uid)
            .ilike('status', 'refunded')
        : Promise.resolve({ data: [] as { refund_amount_cents: number | null; order_value_cents: number | null }[] }),
      uid
        ? supabase
            .from('orders')
            .select('id, provider, merchant_name, refund_amount_cents, order_value_cents, updated_at')
            .eq('user_id', uid)
            .eq('status', 'pending_refund')
        : Promise.resolve({
            data: [] as {
              id: string;
              provider: string;
              merchant_name: string | null;
              refund_amount_cents: number | null;
              order_value_cents: number | null;
              updated_at: string;
            }[],
          }),
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
    { data: refundedOrdersForSum },
    { data: pendingRefundOrders },
  ] = mainData;

  const [deliveryOrderCountRes, rideOrderCountRes, foodOrderCountRes] = orderCountsData;
  const deliveryOrderCount = deliveryOrderCountRes.count ?? 0;
  const rideOrderCount = rideOrderCountRes.count ?? 0;
  const foodOrderCount = foodOrderCountRes.count ?? 0;

  const safeRefunds = refunds ?? [];
  const safeReceipts = receipts ?? [];
  const safeClaims = claims ?? [];
  const safeOpportunities = (opportunities ?? []).map((o) => {
    // ensure orders is always an array
    const ordersArray = Array.isArray(o.orders) ? o.orders : [];

    return {
      id: o.id,
      merchant_name: ordersArray[0]?.merchant_name ?? null,
      order_date: ordersArray[0]?.order_date ?? null,
      order_provider: (ordersArray[0] as { provider?: string } | undefined)?.provider ?? null,
      potential_refund_cents: o.potential_refund_cents,
      currency: o.currency,
      status: o.status as 'open' | 'claimed' | 'refunded' | 'dismissed',
      delay_minutes: o.delay_minutes,
      created_at:
        typeof o.created_at === 'string'
          ? o.created_at
          : '',
    };
  });

  const totalRecoveredCentsFromOrders = (refundedOrdersForSum ?? []).reduce((sum, row) => {
    const r = row.refund_amount_cents;
    if (typeof r === 'number' && r > 0) return sum + r;
    return sum;
  }, 0);

  const totalRecoveredCents = totalRecoveredCentsFromOrders;
  const totalRecovered = totalRecoveredCents / 100;

  const refundStatusCardRows: RefundStatusCardRow[] = [];

  for (const r of safeRefunds.slice(0, 40)) {
    refundStatusCardRows.push({
      id: `paid-${r.id}`,
      uiStatus: 'paid',
      providerKey: r.provider ?? 'other',
      merchantLabel: (r.provider ?? 'Refund').replace(/_/g, ' '),
      amount_cents: r.amount_cents ?? 0,
      currency: r.currency,
      occurred_at: r.completed_at,
    });
  }

  for (const o of pendingRefundOrders ?? []) {
    refundStatusCardRows.push({
      id: `proc-${o.id}`,
      uiStatus: 'processing',
      providerKey: o.provider,
      merchantLabel: o.merchant_name?.trim() || o.provider.replace(/_/g, ' '),
      amount_cents: o.refund_amount_cents ?? o.order_value_cents ?? 0,
      currency: 'USD',
      occurred_at: o.updated_at,
    });
  }

  for (const o of safeOpportunities) {
    if (o.status !== 'open') continue;
    refundStatusCardRows.push({
      id: `det-${o.id}`,
      uiStatus: 'detected',
      providerKey: o.order_provider ?? 'other',
      merchantLabel: o.merchant_name?.trim() || 'Detected opportunity',
      amount_cents: o.potential_refund_cents ?? 0,
      currency: o.currency,
      occurred_at: o.created_at,
    });
  }

  refundStatusCardRows.sort((a, b) => {
    const ta = a.occurred_at ? new Date(a.occurred_at).getTime() : 0;
    const tb = b.occurred_at ? new Date(b.occurred_at).getTime() : 0;
    return tb - ta;
  });

  const lockedOpportunityCentsFreeTier = !isProSubscriber(billingProfile)
    ? safeOpportunities
        .filter((o) => o.status === 'open')
        .reduce((max, o) => Math.max(max, o.potential_refund_cents ?? 0), 0)
    : 0;

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

      {/* Hero + scan */}
      <section className="mb-6 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-stretch lg:gap-6">
        <div className="min-w-0 flex-1">
          <TotalRecoveredHero
            totalDollars={totalRecovered}
            subtitle="Real-time monitoring of your savings."
          />
        </div>
        <div className="flex min-h-[44px] flex-col justify-center lg:w-56 lg:max-w-sm">
          <ScanButton className="w-full lg:max-w-none" />
        </div>
      </section>

      <header className="mt-6 flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-3xl">Dashboard</h1>
        <p className="text-base text-[var(--muted)] sm:text-sm">A clear view of your refunds and savings — only your account</p>
      </header>

      {user ? (
        <div className="mt-5 space-y-4">
          <FirstRecoveryBanner
            userId={user.id}
            totalCents={totalRecoveredCents}
            refundCount={(refundedOrdersForSum ?? []).length}
            isPro={isPro}
          />
          {!isPro && lockedOpportunityCentsFreeTier > 0 ? (
            <LockedCompensationCard amountDollars={lockedOpportunityCentsFreeTier / 100} />
          ) : null}
        </div>
      ) : null}

      <section className="mt-6" aria-labelledby="dashboard-setup-heading">
        <h2 id="dashboard-setup-heading" className="sr-only">
          Quick start
        </h2>
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

      <section className="mt-8 sm:mt-10" aria-labelledby="ai-priority-heading">
        <h2 id="ai-priority-heading" className="sr-only">
          Savings tools
        </h2>
        {/* Not wrapped in Deferred: idle deferral felt like needing a second tap before the section mounted */}
        <AiPriorityEngineTable />
      </section>

      <section className="mt-6 grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)]/60 px-4 py-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 sm:text-[10px] sm:text-zinc-500">In progress</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-200">{pendingClaimsCount}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 sm:text-[10px] sm:text-zinc-500">Updates tracked</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-violet-200">{submittedClaimsCount}</p>
        </div>
        {pendingClaimsCount === 0 && submittedClaimsCount === 0 ? (
          <p className="text-base leading-snug text-zinc-400 sm:col-span-2 sm:text-[11px] sm:text-zinc-500">
            Waiting for your first scan...
          </p>
        ) : null}
      </section>

      {/* Mobile: recovered opportunities before activity; desktop: orders → monitors → recovered → activity */}
      <div className="mt-8 flex flex-col gap-8 sm:gap-10">
        <div className="order-1">
          <Deferred
            fallback={
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-base text-[var(--muted)] sm:text-sm">
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
        </div>

        <section className="order-3 lg:order-2" aria-labelledby="monitor-cards-heading">
          <h2 id="monitor-cards-heading" className="sr-only">
            Monitoring by category
          </h2>
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

        <section className="order-2 lg:order-3">
          <RecoveredRefundOpportunities items={safeOpportunities} />
        </section>

        <section className="order-4 grid gap-6 lg:grid-cols-2">
          <ActivityFeed items={activityItems} />
          <RefundStatusCards rows={refundStatusCardRows} maxCards={12} />
        </section>
      </div>
    </div>
  );
}
