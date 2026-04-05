/** Stable placeholder while viewport / lazy chunks resolve — avoids hydration + removeChild races. */
export function ConnectionSetupSkeleton() {
  return (
    <div
      className="w-full max-w-none rounded-2xl border border-[var(--border)] bg-[var(--card)]/50 p-4 sm:p-5 min-h-[200px] animate-pulse"
      aria-hidden
    />
  );
}
