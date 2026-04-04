import { createClient } from '@/lib/supabase/client';

export type PlatformId = 'amazon' | 'uber_eats' | 'uber' | 'doordash';

export const US_PLATFORMS: { id: PlatformId; label: string }[] = [
  { id: 'amazon', label: 'Amazon' },
  { id: 'uber_eats', label: 'Uber Eats' },
  { id: 'uber', label: 'Uber Rides' },
  { id: 'doordash', label: 'DoorDash' },
];

function emptyCounts(): Record<PlatformId, number> {
  return { amazon: 0, uber_eats: 0, uber: 0, doordash: 0 };
}

/** Map refund_history.provider strings into US platform buckets. */
export function matchRefundToPlatform(provider: string | null | undefined): PlatformId | null {
  const p = (provider ?? '').toLowerCase();
  if (p.includes('amazon')) return 'amazon';
  if (p.includes('eats') || p.includes('uber_eats')) return 'uber_eats';
  if (p.includes('doordash')) return 'doordash';
  if (p.includes('uber')) return 'uber';
  return null;
}

export type UsPlatformStats = {
  orderCounts: Record<PlatformId, number>;
  compensationCents: Record<PlatformId, number>;
  fetchedAt: string;
  /** Set when GET /api/orders fails with DB not provisioned (run `supabase/quick_fix_orders.sql`). */
  ordersUnavailable?: 'missing_table' | 'error';
};

export async function fetchUsPlatformStats(): Promise<UsPlatformStats | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const res = await fetch(`${origin}/api/orders?limit=200`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) {
    if (res.status === 503) {
      const json = (await res.json().catch(() => null)) as { db?: string } | null;
      if (json?.db === 'missing_table') {
        return {
          orderCounts: emptyCounts(),
          compensationCents: emptyCounts(),
          fetchedAt: new Date().toISOString(),
          ordersUnavailable: 'missing_table' as const,
        };
      }
    }
    return {
      orderCounts: emptyCounts(),
      compensationCents: emptyCounts(),
      fetchedAt: new Date().toISOString(),
      ordersUnavailable: 'error' as const,
    };
  }
  const json = (await res.json()) as { orders?: Array<{ provider?: string | null }> };
  const rows = json.orders ?? [];

  const orderCounts = emptyCounts();
  for (const o of rows) {
    const p = o.provider ?? '';
    if (p === 'amazon') orderCounts.amazon += 1;
    else if (p === 'uber_eats') orderCounts.uber_eats += 1;
    else if (p === 'uber') orderCounts.uber += 1;
    else if (p === 'doordash') orderCounts.doordash += 1;
  }

  const compensationCents = emptyCounts();
  const { data: refunds } = await supabase
    .from('refund_history')
    .select('amount_cents, provider')
    .limit(500);

  for (const r of refunds ?? []) {
    const bucket = matchRefundToPlatform(r.provider);
    if (bucket && typeof r.amount_cents === 'number') {
      compensationCents[bucket] += r.amount_cents;
    }
  }

  return {
    orderCounts,
    compensationCents,
    fetchedAt: new Date().toISOString(),
  };
}

export function formatCents(cents: number): string {
  if (!Number.isFinite(cents) || cents === 0) return '$0.00';
  return `$${(cents / 100).toFixed(2)}`;
}
