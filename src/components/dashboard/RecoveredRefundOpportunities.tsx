import type { ReactNode } from 'react';

type Opportunity = {
  id: string;
  merchant_name: string | null;
  order_date: string | null;
  potential_refund_cents: number | null;
  currency: string | null;
  status: 'open' | 'claimed' | 'refunded' | 'dismissed';
  delay_minutes: number | null;
};

interface Props {
  items: Opportunity[];
  actions?: ReactNode;
}

export function RecoveredRefundOpportunities({ items, actions }: Props) {
  const hasItems = items.length > 0;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">
            Recovered Refund Opportunities
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            We found money you may be owed from past orders.
          </p>
        </div>
        {actions}
      </div>
      {!hasItems ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          No opportunities detected yet. Install the Chrome extension and visit
          order pages to monitor deliveries automatically.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="py-2 pr-4 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  Order
                </th>
                <th className="py-2 pr-4 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  Date
                </th>
                <th className="py-2 pr-4 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  Delay
                </th>
                <th className="py-2 text-right text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  Potential refund
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[var(--border)]/60 last:border-0"
                >
                  <td className="py-2 pr-4 text-[var(--foreground)]">
                    {item.merchant_name ?? 'Unknown merchant'}
                  </td>
                  <td className="py-2 pr-4 text-[var(--muted)]">
                    {item.order_date
                      ? new Date(item.order_date).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="py-2 pr-4 text-[var(--muted)]">
                    {item.delay_minutes != null
                      ? `${item.delay_minutes} min late`
                      : '—'}
                  </td>
                  <td className="py-2 text-right font-medium text-[var(--accent)]">
                    {item.potential_refund_cents != null
                      ? `$${(item.potential_refund_cents / 100).toFixed(2)}`
                      : 'Estimate pending'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

