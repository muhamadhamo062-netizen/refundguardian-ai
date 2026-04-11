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
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Compensation history</h1>
        <p className="mt-1 text-[var(--muted)]">
          Compensation recovered through Refyndra AI (Autonomous Compensation Engine).
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        {!refunds || refunds.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-[var(--muted)]">No compensation recorded yet.</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Connect your accounts and keep the agent running — recoveries appear here as they complete.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-block rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:bg-[var(--accent-muted)]"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
            <table className="w-full min-w-0 sm:min-w-[500px]">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)] sm:px-6 sm:py-4">
                    Date
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)] sm:px-6 sm:py-4">
                    Provider
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--muted)] sm:px-6 sm:py-4">
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
                    <td className="px-3 py-3 text-sm text-white sm:px-6 sm:py-4">
                      {new Date(refund.completed_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3 text-sm break-words text-[var(--foreground)] sm:px-6 sm:py-4">
                      {refund.provider}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-medium text-[var(--accent)] sm:px-6 sm:py-4">
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
