import type { ActivityItem } from '@/components/dashboard/ActivityFeed';
import { formatRelativeTime } from '@/lib/dashboard/formatRelativeTime';

type OrderRow = {
  id: string;
  merchant_name: string | null;
  order_id: string | null;
  provider: string | null;
  created_at: string;
};

type ReceiptRow = {
  id: string;
  source: string | null;
  status: string | null;
  created_at: string;
};

type ClaimRow = {
  id: string;
  status: string | null;
  provider: string | null;
  created_at: string;
};

type RefundRow = {
  id: string;
  provider: string | null;
  amount_cents: number | null;
  completed_at: string;
};

type OpportunityRow = {
  id: string;
  merchant_name: string | null;
  delay_minutes: number | null;
  created_at: string;
};

type ExtensionSyncRow = {
  id: string;
  event_type: string;
  order_count: number;
  created_at: string;
};

const MAX_ITEMS = 12;

function extensionSyncLabel(eventType: string): string {
  if (eventType === 'amazon_orders_batch') return 'Amazon';
  return eventType.replace(/_/g, ' ');
}

function atMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Merge recent user-visible events into a single feed (newest first).
 */
export function buildActivityFeedItems(input: {
  orders?: OrderRow[] | null;
  receipts?: ReceiptRow[] | null;
  claims?: ClaimRow[] | null;
  refunds?: RefundRow[] | null;
  opportunities?: OpportunityRow[] | null;
  extensionSyncs?: ExtensionSyncRow[] | null;
}): ActivityItem[] {
  const tmp: { item: ActivityItem; t: number }[] = [];

  for (const o of input.orders ?? []) {
    const label =
      (o.merchant_name && o.merchant_name.trim()) ||
      o.order_id ||
      o.provider ||
      'Order';
    tmp.push({
      t: atMs(o.created_at),
      item: {
        id: `order-${o.id}`,
        type: 'scan',
        title: `Order synced · ${String(label).slice(0, 80)}`,
        time: formatRelativeTime(o.created_at),
      },
    });
  }

  for (const r of input.receipts ?? []) {
    const src = (r.source ?? 'receipt').replace(/_/g, ' ');
    tmp.push({
      t: atMs(r.created_at),
      item: {
        id: `receipt-${r.id}`,
        type: 'scan',
        title: `Receipt ${r.status ?? 'logged'} · ${src}`,
        time: formatRelativeTime(r.created_at),
      },
    });
  }

  for (const c of input.claims ?? []) {
    const st = c.status ?? 'updated';
    const pv = c.provider ? ` · ${c.provider}` : '';
    tmp.push({
      t: atMs(c.created_at),
      item: {
        id: `claim-${c.id}`,
        type: 'claim',
        title: `Claim ${st}${pv}`,
        time: formatRelativeTime(c.created_at),
      },
    });
  }

  for (const r of input.refunds ?? []) {
    const amt =
      typeof r.amount_cents === 'number'
        ? `$${(r.amount_cents / 100).toFixed(2)}`
        : '';
    const pv = r.provider ?? 'Compensation';
    tmp.push({
      t: atMs(r.completed_at),
      item: {
        id: `refund-${r.id}`,
        type: 'refund',
        title: amt ? `Compensation recorded · ${pv} ${amt}` : `Compensation recorded · ${pv}`,
        time: formatRelativeTime(r.completed_at),
      },
    });
  }

  for (const op of input.opportunities ?? []) {
    const name = op.merchant_name?.trim() || 'Order';
    const delay =
      typeof op.delay_minutes === 'number' && op.delay_minutes > 0
        ? ` · ${op.delay_minutes} min late`
        : '';
    tmp.push({
      t: atMs(op.created_at),
      item: {
        id: `opp-${op.id}`,
        type: 'check',
        title: `Delay signal · ${name.slice(0, 60)}${delay}`,
        time: formatRelativeTime(op.created_at),
      },
    });
  }

  for (const e of input.extensionSyncs ?? []) {
    const n = typeof e.order_count === 'number' ? e.order_count : 0;
    const lab = extensionSyncLabel(e.event_type || '');
    tmp.push({
      t: atMs(e.created_at),
      item: {
        id: `extsync-${e.id}`,
        type: 'scan',
        title: `Extension sync · ${n} order${n === 1 ? '' : 's'} · ${lab}`,
        time: formatRelativeTime(e.created_at),
      },
    });
  }

  tmp.sort((a, b) => b.t - a.t);
  return tmp.slice(0, MAX_ITEMS).map((x) => x.item);
}
