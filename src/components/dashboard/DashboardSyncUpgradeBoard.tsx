'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GmailImapConnect } from '@/components/dashboard/GmailImapConnect';

type SyncStatusResponse = {
  ok?: boolean;
  connected?: boolean;
};

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2.5l7 3.2v5.5c0 4.6-2.9 8.8-7 10.3-4.1-1.5-7-5.7-7-10.3V5.7l7-3.2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9.2 12.3l1.7 1.7 4.1-4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconKey({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="8" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 10h8.5M17.5 10v3M15 13v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconBolt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M13 2L4 14h7l-1 8 10-14h-7l0-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const steps = [
  {
    Icon: IconShield,
    title: 'Security',
    body: 'Enable 2-Step Verification on your Google Account — required before Google will issue a sync code.',
  },
  {
    Icon: IconKey,
    title: 'Google Sync Code',
    body: 'Create your 16-character Google Sync Code (Google labels it an App Password) under Security → App passwords.',
  },
  {
    Icon: IconBolt,
    title: 'Sync',
    body: 'Paste your Gmail and the 16-character code once. Refyndra pulls order emails and activates your live table.',
  },
] as const;

export function DashboardSyncUpgradeBoard() {
  const [checking, setChecking] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadStatus() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const headers: HeadersInit = {};
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }

        const res = await fetch('/api/user/gmail-imap', {
          credentials: 'include',
          cache: 'no-store',
          headers,
        });
        const body = (await res.json().catch(() => ({}))) as SyncStatusResponse;
        if (!alive) return;
        setDismissed(Boolean(body.ok && body.connected));
      } finally {
        if (alive) setChecking(false);
      }
    }

    void loadStatus();
    return () => {
      alive = false;
    };
  }, []);

  if (checking || dismissed) {
    return null;
  }

  return (
    <section
      id="gmail-engine"
      aria-label="Gmail sync engine"
      className="relative mt-10 scroll-mt-24 overflow-hidden rounded-3xl border border-violet-400/25 bg-white/[0.03] p-5 shadow-[0_0_60px_rgba(139,92,246,0.18)] ring-1 ring-violet-400/20 backdrop-blur-xl sm:p-7"
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-200/85">Engine</p>
        <h2 className="mt-2 bg-gradient-to-r from-white via-zinc-100 to-violet-100 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
          Gmail sync — start the engine
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-300 sm:text-base">
          Three quick steps — then Refyndra continuously syncs receipts and delivery signals into your command center.
        </p>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-zinc-500 sm:text-sm">
          Separate from your Refyndra password. The sync code only authorizes read-only mailbox access for order-related
          messages — never your main Gmail password.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {steps.map(({ Icon, title, body }) => (
            <article key={title} className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4">
              <Icon className="h-8 w-8 text-violet-300/90" />
              <h3 className="mt-2 text-base font-semibold text-white">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">{body}</p>
            </article>
          ))}
        </div>

        <div className="mt-6">
          <GmailImapConnect
            hideWhenConnected
            primaryCtaLabel="Start engine"
            onConnectionChange={(connected) => connected && setDismissed(true)}
          />
        </div>
      </div>
    </section>
  );
}
