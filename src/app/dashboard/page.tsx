import { createClient } from '@/lib/supabase/server';
import { AnimatedCounter } from '@/components/dashboard/AnimatedCounter';
import { MonitorCard } from '@/components/dashboard/MonitorCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { RefundHistoryTable } from '@/components/dashboard/RefundHistoryTable';
import { ScanButton } from '@/components/dashboard/ScanButton';
import { RecoveredRefundOpportunities } from '@/components/dashboard/RecoveredRefundOpportunities';
import { ExtensionToken } from '@/components/dashboard/ExtensionToken';

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
  const [
    { data: refunds },
    { data: receipts },
    { data: claims },
    { data: opportunities },
  ] = await Promise.all([
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
        'id, potential_refund_cents, currency, status, delay_minutes, orders(merchant_name, order_date)'
      )
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const safeRefunds = refunds ?? [];
  const safeReceipts = receipts ?? [];
  const safeClaims = claims ?? [];
  const safeOpportunities = (opportunities ?? []).map((o: { id: string; potential_refund_cents: number | null; currency: string | null; status: string; delay_minutes: number | null; orders: { merchant_name: string | null; order_date: string | null } | null }) => ({
    id: o.id,
    merchant_name: o.orders?.merchant_name ?? null,
    order_date: o.orders?.order_date ?? null,
    potential_refund_cents: o.potential_refund_cents,
    currency: o.currency,
    status: o.status as 'open' | 'claimed' | 'refunded' | 'dismissed',
    delay_minutes: o.delay_minutes,
  }));

  const totalRecoveredCents = safeRefunds.reduce(
    (sum, r) => sum + (r.amount_cents ?? 0),
    0
  );
  const totalRecovered = totalRecoveredCents / 100;

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

  const activityItems = [
    {
      id: '1',
      type: 'scan' as const,
      title: 'Scanning receipts...',
      time: 'Just now',
    },
    {
      id: '2',
      type: 'check' as const,
      title: 'Checking delivery times...',
      time: '1m ago',
    },
    {
      id: '3',
      type: 'claim' as const,
      title: 'Submitting refund claim...',
      time: '5m ago',
    },
    {
      id: '4',
      type: 'refund' as const,
      title: 'Refund confirmed.',
      time: '12m ago',
    },
  ];

  const refundHistoryRows = safeRefunds.map((r) => ({
    id: r.id,
    provider: r.provider ?? '—',
    amount_cents: r.amount_cents ?? 0,
    currency: r.currency,
    completed_at: r.completed_at,
    status: 'Completed',
  }));

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Your refund control center
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ExtensionToken />
          <ScanButton />
        </div>
      </div>

      {/* Top: Total Refunds Recovered — large animated counter */}
      <section className="mt-8 sm:mt-10">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-[#0a0c10] p-8 shadow-2xl shadow-black/30 sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,var(--accent)/8%,transparent)]" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Total Refunds Recovered
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
              All time · Powered by RefundGuardian AI
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
            ordersScanned={deliveryReceipts.length}
            claimsSubmitted={deliveryClaims.length}
            refundsRecovered={deliveryRefunds.length}
            accentColor="emerald"
          />
          <MonitorCard
            title="Ride Delay Monitor"
            icon={<RideIcon />}
            ordersScanned={rideReceipts.length}
            claimsSubmitted={rideClaims.length}
            refundsRecovered={rideRefunds.length}
            accentColor="amber"
          />
          <MonitorCard
            title="Order Refund Monitor"
            icon={<OrderIcon />}
            ordersScanned={orderReceipts.length}
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
