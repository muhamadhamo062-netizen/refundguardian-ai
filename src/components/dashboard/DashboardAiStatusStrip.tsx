'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type StatusBody = {
  ok?: boolean;
  aiDraftingEnabled?: boolean;
  systemActive?: boolean;
  openaiLinked?: boolean;
  modelLabel?: string;
};

/** Signed-in dashboard only: shows whether server OpenAI is wired for the AI Lawyer. */
export function DashboardAiStatusStrip() {
  const [body, setBody] = useState<StatusBody | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch('/api/ai/status', {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const j = (await res.json().catch(() => ({}))) as StatusBody;
        if (!cancelled) setBody(j);
      } catch {
        if (!cancelled) setBody({ ok: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const linked = Boolean(body?.openaiLinked ?? body?.aiDraftingEnabled);
  const active = Boolean(body?.systemActive ?? linked);
  const model = typeof body?.modelLabel === 'string' && body.modelLabel ? body.modelLabel : null;

  if (body === null) {
    return (
      <span className="inline-flex max-w-[min(100%,14rem)] truncate rounded-md border border-[var(--border)] bg-[var(--card)]/80 px-2 py-1 text-[10px] font-medium text-zinc-500">
        AI status…
      </span>
    );
  }

  return (
    <span
      className={`inline-flex max-w-[min(100%,16rem)] truncate rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
        active
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
          : 'border-amber-500/35 bg-amber-500/10 text-amber-100'
      }`}
      title={model ? `Model: ${model}` : undefined}
      translate="no"
    >
      {active ? 'System active' : 'System idle'}
      <span className="mx-1.5 text-zinc-500">·</span>
      {linked ? 'OpenAI linked' : 'OpenAI not linked'}
    </span>
  );
}
