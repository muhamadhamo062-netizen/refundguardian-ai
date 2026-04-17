/** Normalize `refund_history.provider` values to dashboard platform keys. */
export type DashboardPlatformKey = 'amazon' | 'uber_eats' | 'uber_rides' | 'doordash';

const ALL_KEYS: DashboardPlatformKey[] = ['amazon', 'uber_eats', 'uber_rides', 'doordash'];

export function emptyPlatformCents(): Record<DashboardPlatformKey, number> {
  return { amazon: 0, uber_eats: 0, uber_rides: 0, doordash: 0 };
}

export function normalizeRefundProvider(provider: string | null | undefined): DashboardPlatformKey | null {
  const p = (provider ?? '').toLowerCase().trim();
  if (p === 'amazon') return 'amazon';
  if (p === 'uber_eats' || p === 'ubereats' || p === 'uber eats') return 'uber_eats';
  if (p === 'uber' || p === 'uber_rides' || p === 'uber rides' || p === 'uber_ride') return 'uber_rides';
  if (p === 'doordash' || p === 'door_dash') return 'doordash';
  return null;
}

export function aggregateRefundCentsByPlatform(
  rows: Array<{ provider?: string | null; amount_cents?: number | null }>
): Record<DashboardPlatformKey, number> {
  const out = emptyPlatformCents();
  for (const row of rows) {
    const key = normalizeRefundProvider(row.provider);
    if (!key) continue;
    const c = row.amount_cents;
    if (typeof c === 'number' && c > 0) out[key] += c;
  }
  return out;
}

export function sumPlatformCents(cents: Record<DashboardPlatformKey, number>): number {
  return ALL_KEYS.reduce((s, k) => s + (cents[k] ?? 0), 0);
}
