'use client';

import Link from 'next/link';
import { LANDING_PRIMARY_CTA_GLOW } from '@/lib/landingPrimaryCta';

/**
 * Marketing-only preview of the AI Priority Engine — not the real dashboard table.
 * No Supabase, no Gmail, no shared persistence.
 */

const DEMO_PLATFORMS = [
  {
    label: 'Amazon',
    autoDetail: 'Smart monitoring: We track promised vs. actual arrival times 24/7.',
    manual: ['Missing item', 'Damaged'],
  },
  {
    label: 'Uber Eats',
    autoDetail: 'Smart monitoring: We track promised vs. actual arrival times 24/7.',
    manual: ['Cold food'],
  },
  {
    label: 'Uber Rides',
    autoDetail: 'Smart monitoring: We compare ETA vs. actual trip completion 24/7.',
    manual: ['Trip issue'],
  },
  {
    label: 'DoorDash',
    autoDetail: 'Smart monitoring: We track promised vs. actual arrival times 24/7.',
    manual: ['Missing item'],
  },
] as const;

export function AiPriorityEngineShowcase() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-transparent to-violet-500/10 blur-xl"
      />
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-[#0a0c10] shadow-2xl shadow-black/40">
        <div className="border-b border-[var(--border)] px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
                AI Priority Engine
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">Preview — how it looks in your account</h2>
              <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
                This is a <strong className="font-medium text-zinc-300">static demo</strong> to show the layout. Your real
                orders, Gmail, and drafts are private — only visible after you sign in to your dashboard.
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
              Demo · not your data
            </span>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 sm:p-6">
          {DEMO_PLATFORMS.map((row) => (
            <div
              key={row.label}
              className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/50 p-4 shadow-inner shadow-black/20"
            >
              <p className="text-sm font-semibold text-white">{row.label}</p>
              <div className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold leading-tight text-emerald-50">
                    AI Auto-Detection ⭐
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-emerald-100">{row.autoDetail}</p>
                <p className="mt-2 border-l border-emerald-400/25 pl-2 text-[9px] italic leading-snug text-emerald-200/55">
                  Tracked for you — no checkbox.
                </p>
              </div>
              <div className="mt-3 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md border border-zinc-600/80 bg-zinc-950/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-400">
                    Additional Claims
                  </span>
                  <span className="text-[10px] font-medium text-zinc-500">(Optional)</span>
                </div>
                <p className="text-[10px] leading-snug text-zinc-500">
                  Report issues like: Missing item, cold food, or damaged goods.
                </p>
              </div>
              <ul className="mt-2 space-y-1.5">
                {row.manual.map((m) => (
                  <li
                    key={m}
                    className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/20 px-2 py-1.5 text-[11px] text-zinc-300"
                  >
                    <span className="h-3.5 w-3.5 rounded border border-emerald-500/50 bg-emerald-500/20" aria-hidden />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-stretch justify-between gap-4 border-t border-[var(--border)] px-4 py-4 sm:flex-row sm:items-center sm:px-6">
          <div className="max-w-xl rounded-xl border border-emerald-500/20 bg-emerald-950/25 px-4 py-3 shadow-inner shadow-black/20">
            <p className="text-xs font-medium leading-relaxed text-zinc-200">
              The real table with your data — Gmail, drafts, and send — only on your dashboard after sign-in.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span
              className="inline-flex cursor-not-allowed items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-xs font-medium text-zinc-500"
              title="Sign in to use the real Draft message"
            >
              Draft message (demo)
            </span>
            <Link
              href="/login"
              className={`inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--background)] ${LANDING_PRIMARY_CTA_GLOW}`}
            >
              Sign in — your private engine
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/10 bg-[var(--background)]/50 px-5 text-sm font-medium text-zinc-200 backdrop-blur-sm transition-all duration-300 ease-out hover:scale-[1.03] hover:border-emerald-500/25 hover:bg-white/[0.06] active:scale-[0.98]"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
