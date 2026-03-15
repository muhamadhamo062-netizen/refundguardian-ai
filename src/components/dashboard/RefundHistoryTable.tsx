import Link from 'next/link';

export interface RefundHistoryRow {
  id: string;
  provider: string;
  amount_cents: number;
  currency?: string | null;
  completed_at: string | null;
  status?: string;
}

interface RefundHistoryTableProps {
  rows: RefundHistoryRow[];
  maxRows?: number;
}

export function RefundHistoryTable({ rows, maxRows = 10 }: RefundHistoryTableProps) {
  const displayRows = rows.slice(0, maxRows);
  const hasMore = rows.length > maxRows;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-gradient-to-b from-[var(--card)] to-[#0d0e12] shadow-lg shadow-black/20 overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4 sm:px-6">
        <div>
          <h3 className="text-sm font-semibold text-white">Refund History</h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Provider, amount, date, and status
          </p>
        </div>
        {rows.length > maxRows && (
          <Link
            href="/dashboard/refund-history"
            className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-muted)]"
          >
            View all
          </Link>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-white/[0.02]">
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-6">
                Provider
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-6">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-6 hidden sm:table-cell">
                Date
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] sm:px-6">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--muted)] sm:px-6">
                  No refunds yet. Run a scan to start recovering money.
                </td>
              </tr>
            ) : (
              displayRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--border)]/50 last:border-0 transition-colors hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 text-sm font-medium text-white sm:px-6">
                    {row.provider}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-[var(--accent)] sm:px-6">
                    ${((row.amount_cents ?? 0) / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--muted)] hidden sm:table-cell sm:px-6">
                    {row.completed_at
                      ? new Date(row.completed_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right sm:px-6">
                    <span className="inline-flex items-center rounded-full bg-[var(--accent)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
                      {row.status ?? 'Completed'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="border-t border-[var(--border)] px-4 py-2 text-center sm:px-6">
          <Link
            href="/dashboard/refund-history"
            className="text-xs font-medium text-[var(--muted)] hover:text-[var(--accent)]"
          >
            View full history →
          </Link>
        </div>
      )}
    </div>
  );
}
