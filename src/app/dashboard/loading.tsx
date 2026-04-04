export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="space-y-4">
        <div className="h-8 w-56 rounded-lg bg-white/[0.06]" />
        <div className="h-4 w-80 max-w-full rounded-lg bg-white/[0.05]" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="h-44 rounded-2xl border border-[var(--border)] bg-[var(--card)]/60" />
        <div className="h-44 rounded-2xl border border-[var(--border)] bg-[var(--card)]/60" />
      </div>

      <div className="mt-6 h-80 rounded-2xl border border-[var(--border)] bg-[var(--card)]/60" />
    </div>
  );
}

