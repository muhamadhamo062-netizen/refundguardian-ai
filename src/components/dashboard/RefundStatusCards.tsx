import Link from 'next/link';

export type RefundStatusCardRow = {
  id: string;
  /** processing = delay/claim path; detected = open opportunity; paid = money back */
  uiStatus: 'processing' | 'detected' | 'paid';
  providerKey: string;
  merchantLabel: string;
  amount_cents: number;
  currency?: string | null;
  occurred_at: string | null;
};

function PlatformMark({ providerKey }: { providerKey: string }) {
  const p = providerKey.toLowerCase();
  if (p.includes('amazon') || p === 'amazon')
    return (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF9900]/15 text-lg font-bold text-[#FF9900]"
        aria-hidden
      >
        a
      </span>
    );
  if (p.includes('uber_eats') || p.includes('eats'))
    return (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#06C167]/15 text-lg"
        aria-hidden
      >
        🍔
      </span>
    );
  if (p.includes('uber'))
    return (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-700/50 text-lg"
        aria-hidden
      >
        🚗
      </span>
    );
  if (p.includes('doordash'))
    return (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF3008]/15 text-lg font-bold text-[#FF3008]"
        aria-hidden
      >
        D
      </span>
    );
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-sm font-semibold text-zinc-300">
      $
    </span>
  );
}

function StatusPill({ uiStatus }: { uiStatus: RefundStatusCardRow['uiStatus'] }) {
  const styles: Record<RefundStatusCardRow['uiStatus'], string> = {
    processing: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
    detected: 'bg-amber-500/15 text-amber-200 border-amber-500/35',
    paid: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
  };
  const label: Record<RefundStatusCardRow['uiStatus'], string> = {
    processing: 'Processing',
    detected: 'Detected',
    paid: 'Paid',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${styles[uiStatus]}`}
    >
      {label[uiStatus]}
    </span>
  );
}

interface RefundStatusCardsProps {
  rows: RefundStatusCardRow[];
  maxCards?: number;
}

export function RefundStatusCards({ rows, maxCards = 10 }: RefundStatusCardsProps) {
  const display = rows.slice(0, maxCards);
  const hasMore = rows.length > maxCards;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-gradient-to-b from-[var(--card)] to-[#0d0e12] shadow-lg shadow-black/20 overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-[var(--border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h3 className="text-sm font-semibold text-white">Refund status</h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Paid, detected opportunities, and items still processing
          </p>
        </div>
        {rows.length > maxCards && (
          <Link
            href="/dashboard/refund-history"
            className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-muted)]"
          >
            View all
          </Link>
        )}
      </div>

      <ul className="divide-y divide-[var(--border)]/60">
        {display.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-[var(--muted)] sm:px-6">
            No refund activity yet. Connect Gmail or the extension — matches will appear here.
          </li>
        ) : (
          display.map((row) => (
            <li
              key={row.id}
              className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-white/[0.03] sm:gap-4 sm:px-6"
            >
              <PlatformMark providerKey={row.providerKey} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium text-white">{row.merchantLabel}</p>
                  <StatusPill uiStatus={row.uiStatus} />
                </div>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {row.occurred_at
                    ? new Date(row.occurred_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—'}
                </p>
              </div>
              <p className="shrink-0 text-right text-lg font-bold tabular-nums text-emerald-400">
                ${((row.amount_cents ?? 0) / 100).toFixed(2)}
              </p>
            </li>
          ))
        )}
      </ul>

      {hasMore && (
        <div className="border-t border-[var(--border)] px-4 py-3 text-center sm:px-6">
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
