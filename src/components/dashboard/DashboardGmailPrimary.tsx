'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GmailImapConnect } from '@/components/dashboard/GmailImapConnect';

type SyncStatusResponse = {
  ok?: boolean;
  connected?: boolean;
  gmail_address?: string | null;
};

/**
 * Primary dashboard action — Gmail / App Password “Start engine” (always directly under grand total).
 */
export function DashboardGmailPrimary() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const headers: HeadersInit = {};
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        const res = await fetch('/api/user/gmail-imap', { credentials: 'include', headers, cache: 'no-store' });
        const body = (await res.json().catch(() => ({}))) as SyncStatusResponse;
        if (!alive) return;
        setConnected(Boolean(body.ok && body.connected));
        setEmail(typeof body.gmail_address === 'string' ? body.gmail_address : null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div
        className="mt-6 h-28 animate-pulse rounded-2xl border border-white/15 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl"
        aria-hidden
      />
    );
  }

  if (connected && email) {
    return (
      <section
        className="relative mt-6 overflow-hidden rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/[0.12] via-white/[0.04] to-violet-500/[0.08] px-4 py-3.5 shadow-[0_8px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl sm:px-5 sm:py-4"
        aria-label="Gmail engine status"
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/20 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/95">Engine running</p>
          <p className="mt-1 truncate text-sm font-semibold text-white">{email}</p>
          <p className="mt-1 text-xs leading-relaxed text-emerald-100/75">
            Inbox sync is live — new orders appear in your dashboard as they arrive.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="gmail-engine"
      className="relative mt-6 scroll-mt-24 overflow-hidden rounded-2xl border border-white/18 bg-gradient-to-br from-white/[0.12] via-violet-500/[0.06] to-emerald-500/[0.05] p-4 shadow-[0_12px_48px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-2xl sm:p-5"
      aria-label="Start Gmail sync"
    >
      <div className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-violet-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -right-10 h-40 w-40 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200/95">Primary action</p>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-white sm:text-xl">
          Link Gmail with an App Password
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-400 sm:max-w-2xl">
          Enable 2-Step Verification in Google Account, create an App Password, and paste it below. This unlocks secure
          order import and one-tap drafts — never your Refyndra sign-in.
        </p>
        <div className="mt-4">
          <GmailImapConnect primaryCtaLabel="Start engine" surface="glass" />
        </div>
      </div>
    </section>
  );
}
