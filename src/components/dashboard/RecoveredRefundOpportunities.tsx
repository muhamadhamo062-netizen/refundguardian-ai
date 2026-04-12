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
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white sm:text-sm">
            Recovered compensation opportunities
          </h2>
          <p className="mt-1 text-base text-[var(--muted)] sm:text-xs">
            Automatic detection surfaces compensation you may be owed from past orders.
          </p>
        </div>
        {actions}
      </div>
      {!hasItems ? (
        <div className="mt-4 space-y-2">
          <p className="text-base text-[var(--muted)] sm:text-sm">
            No opportunities detected yet. Install the Chrome extension and visit
            order pages to monitor deliveries automatically.
          </p>
          <p className="text-base text-zinc-400 sm:text-[11px] sm:text-zinc-500/90">Waiting for your first scan...</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-0 !text-base sm:text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="py-2 pr-4 text-left text-sm font-semibold uppercase tracking-wider text-zinc-300 sm:text-xs sm:font-medium sm:text-[var(--muted)]">
                  Order
                </th>
                <th className="py-2 pr-4 text-left text-sm font-semibold uppercase tracking-wider text-zinc-300 sm:text-xs sm:font-medium sm:text-[var(--muted)]">
                  Date
                </th>
                <th className="py-2 pr-4 text-left text-sm font-semibold uppercase tracking-wider text-zinc-300 sm:text-xs sm:font-medium sm:text-[var(--muted)]">
                  Delay
                </th>
                <th className="py-2 text-right text-sm font-semibold uppercase tracking-wider text-zinc-300 sm:text-xs sm:font-medium sm:text-[var(--muted)]">
                  Potential compensation
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[var(--border)]/60 last:border-0"
                >
                  <td className="max-w-[min(100%,11rem)] py-2.5 pr-4 break-words font-medium text-[var(--foreground)] sm:max-w-none sm:py-2 sm:font-normal">
                    {item.merchant_name ?? 'Unknown merchant'}
                  </td>
                  <td className="py-2.5 pr-4 font-medium text-zinc-200 sm:py-2 sm:font-normal sm:text-[var(--muted)]">
                    {item.order_date
                      ? new Date(item.order_date).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="py-2.5 pr-4 font-medium text-zinc-200 sm:py-2 sm:font-normal sm:text-[var(--muted)]">
                    {item.delay_minutes != null
                      ? `${item.delay_minutes} min late`
                      : '—'}
                  </td>
                  <td className="py-2.5 text-right text-lg font-semibold tabular-nums text-[var(--accent)] sm:py-2 sm:text-sm sm:font-medium">
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

