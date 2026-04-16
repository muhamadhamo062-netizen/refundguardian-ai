'use client';

import { GmailImapConnect } from '@/components/dashboard/GmailImapConnect';

export function ConnectionSetupSection() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <GmailImapConnect />
      <div className="hidden sm:block rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-lg shadow-black/20">
        <p className="text-sm font-semibold text-white">Background scans</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
          Once connected, we run scheduled inbox scans to keep your order vault fresh. If a delay signal is detected,
          we draft a dispute-quality complaint automatically and keep it ready to copy (or send, if you enable auto-send).
        </p>
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Security</p>
          <p className="mt-1 text-xs text-zinc-300">
            Your App Password is encrypted server-side before being stored. You can remove the connection anytime.
          </p>
        </div>
      </div>
    </div>
  );
}

