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
          <h3 className="text-lg font-semibold text-white sm:text-sm">Compensation history</h3>
          <p className="mt-0.5 text-base text-[var(--muted)] sm:text-xs">
            Provider, amount, date, and status
          </p>
        </div>
        {rows.length > maxRows && (
          <Link
            href="/dashboard/refund-history"
            className="text-base font-semibold text-[var(--accent)] hover:text-[var(--accent-muted)] sm:text-xs sm:font-medium"
          >
            View all
          </Link>
        )}
      </div>
      <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <table className="w-full min-w-0 sm:min-w-[400px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-white/[0.02]">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-300 sm:px-6 sm:text-[10px] sm:text-[var(--muted)]">
                Provider
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-300 sm:px-6 sm:text-[10px] sm:text-[var(--muted)]">
                Amount
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-300 sm:table-cell sm:px-6 sm:text-[10px] sm:text-[var(--muted)]">
                Date
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-300 sm:px-6 sm:text-[10px] sm:text-[var(--muted)]">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-base text-[var(--muted)] sm:px-6 sm:text-sm">
                  No compensation recorded yet. The engine keeps running — amounts appear here when applied.
                </td>
              </tr>
            ) : (
              displayRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--border)]/50 last:border-0 transition-colors hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 text-base font-semibold text-white sm:px-6 sm:text-sm sm:font-medium">
                    <span className="break-words">{row.provider}</span>
                    <span className="mt-0.5 block text-base text-zinc-300 sm:hidden">
                      {row.completed_at
                        ? new Date(row.completed_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-lg font-bold tabular-nums text-[var(--accent)] sm:px-6 sm:text-sm sm:font-semibold">
                    ${((row.amount_cents ?? 0) / 100).toFixed(2)}
                  </td>
                  <td className="hidden px-4 py-3 text-base font-medium text-zinc-200 sm:table-cell sm:px-6 sm:text-sm sm:font-normal sm:text-[var(--muted)]">
                    {row.completed_at
                      ? new Date(row.completed_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right sm:px-6">
                    <span className="inline-flex items-center rounded-full bg-[var(--accent)]/15 px-2.5 py-1 text-sm font-semibold text-[var(--accent)] sm:py-0.5 sm:text-xs sm:font-medium">
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
            className="text-base font-semibold text-[var(--muted)] hover:text-[var(--accent)] sm:text-xs sm:font-medium"
          >
            View full history →
          </Link>
        </div>
      )}
    </div>
  );
}
