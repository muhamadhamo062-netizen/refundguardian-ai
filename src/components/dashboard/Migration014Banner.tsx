'use client';

/**
 * Shown when migration 014 (extension_sync_events) is not applied — sync hooks cannot persist.
 */
export function Migration014Banner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
    >
      <p className="break-words font-medium text-amber-50">
        Migration 014 missing – extension_sync_events not persisting.
      </p>
      <p className="mt-1 break-words text-xs text-amber-200/90">
        Apply{' '}
        <code className="break-all rounded bg-black/30 px-1">
          supabase/migrations/014_extension_sync_events.sql
        </code>{' '}
        (or <code className="break-all rounded bg-black/30 px-1">npx supabase db push</code>) so extension sync
        batches are logged.
      </p>
    </div>
  );
}
