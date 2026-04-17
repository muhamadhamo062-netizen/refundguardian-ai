import type { Metadata } from 'next';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { DashboardRefundCelebration } from '@/components/dashboard/DashboardRefundCelebration';

export const metadata: Metadata = {
  other: {},
};

export const dynamic = 'force-dynamic';

/** Shell only — access control is in `src/middleware.ts` + per-page `getUser` for data. */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-root min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
      <DashboardNav />
      <DashboardRefundCelebration />
      <main className="mx-auto w-full min-w-0 max-w-none px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
