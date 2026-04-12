import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function RefundHistoryPage() {
  const supabase = await createClient();
  const { data: refunds } = await supabase
    .from('refund_history')
    .select('*')
    .order('completed_at', { ascending: false })
    .limit(50);

  return (
    <div className="min-w-0 space-y-8 overflow-x-hidden">
      <div>
        <h1 className="text-3xl font-bold text-white sm:text-3xl">Compensation history</h1>
        <p className="mt-1 text-base text-[var(--muted)] sm:text-sm">
          Compensation recovered through Refyndra AI (Autonomous Compensation Engine).
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        {!refunds || refunds.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-base text-[var(--muted)]">No compensation recorded yet.</p>
            <p className="mt-2 text-base text-[var(--muted)] sm:text-sm">
              Connect your accounts and keep the agent running — recoveries appear here as they complete.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-lg bg-[var(--accent)] px-5 py-3 text-base font-bold text-[var(--background)] hover:bg-[var(--accent-muted)] sm:min-h-0 sm:px-4 sm:py-2 sm:text-sm sm:font-medium"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
            <table className="w-full min-w-0 sm:min-w-[500px]">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-3 py-3 text-left text-sm font-semibold uppercase tracking-wider text-zinc-300 sm:px-6 sm:py-4 sm:text-xs sm:font-medium sm:text-[var(--muted)]">
                    Date
                  </th>
                  <th className="px-3 py-3 text-left text-sm font-semibold uppercase tracking-wider text-zinc-300 sm:px-6 sm:py-4 sm:text-xs sm:font-medium sm:text-[var(--muted)]">
                    Provider
                  </th>
                  <th className="px-3 py-3 text-right text-sm font-semibold uppercase tracking-wider text-zinc-300 sm:px-6 sm:py-4 sm:text-xs sm:font-medium sm:text-[var(--muted)]">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((refund) => (
                  <tr
                    key={refund.id}
                    className="border-b border-[var(--border)]/50 last:border-0 hover:bg-[var(--card-hover)]"
                  >
                    <td className="px-3 py-3.5 text-base font-medium text-white sm:px-6 sm:py-4 sm:text-sm sm:font-normal">
                      {new Date(refund.completed_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3.5 text-base font-semibold break-words text-[var(--foreground)] sm:px-6 sm:py-4 sm:text-sm sm:font-normal">
                      {refund.provider}
                    </td>
                    <td className="px-3 py-3.5 text-right text-lg font-bold text-[var(--accent)] sm:px-6 sm:py-4 sm:text-sm sm:font-medium">
                      ${((refund.amount_cents ?? 0) / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
