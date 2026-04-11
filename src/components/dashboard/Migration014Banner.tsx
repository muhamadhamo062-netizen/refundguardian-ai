'use client';

/** Shown when extension sync storage isn’t available — plain language only. */
export function Migration014Banner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
    >
      <p className="break-words font-medium text-amber-50">
        Order sync from the browser isn’t fully enabled yet.
      </p>
      <p className="mt-1 break-words text-xs text-amber-200/90">
        Your administrator may need to finish account setup. If this message stays, contact Refyndra support.
      </p>
    </div>
  );
}
