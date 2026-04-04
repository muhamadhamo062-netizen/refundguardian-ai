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
        In Supabase → <strong className="font-semibold">SQL Editor</strong>: run{' '}
        <code className="break-all rounded bg-black/30 px-1">supabase/QUICK_APPLY_014_015_017.sql</code> (014 + IMAP
        015/017), or apply each file under <code className="rounded bg-black/30 px-1">supabase/migrations/</code> in
        order. With CLI: <code className="rounded bg-black/30 px-1">npx supabase link</code> then{' '}
        <code className="rounded bg-black/30 px-1">npx supabase db push</code>.
      </p>
    </div>
  );
}
