'use client';

import { useEffect, useState } from 'react';

type HealthPayload = {
  ok?: boolean;
  db?: string;
  /** Machine-readable reason from /api/health */
  db_hint?: string;
  /** Sanitized error snippet (debug) */
  db_detail?: string;
  storage?: string;
  imap_app_credentials?: string;
  imap_env?: {
    encryption_key?: 'ok' | 'missing';
    cron_secret?: 'ok' | 'missing';
    service_role?: 'ok' | 'missing';
  };
};

/**
 * Surfaces critical connectivity / env issues from GET /api/health (client fetch).
 * Extension sync migration (014) is surfaced separately via Migration014Banner.
 */
export function DashboardHealthStrip() {
  const [state, setState] = useState<{ loading: boolean; payload: HealthPayload | null; err: string | null }>(
    {
      loading: true,
      payload: null,
      err: null,
    }
  );

  useEffect(() => {
    let alive = true;
    fetch('/api/health')
      .then((r) => r.json().catch(() => ({})))
      .then((p: HealthPayload) => {
        if (!alive) return;
        setState({ loading: false, payload: p, err: null });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setState({
          loading: false,
          payload: null,
          err: e instanceof Error ? e.message : 'Health check failed',
        });
      });
    return () => {
      alive = false;
    };
  }, []);

  if (state.loading || (!state.err && !state.payload)) return null;

  if (state.err) {
    return (
      <div
        role="status"
        className="mt-4 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200"
      >
        Could not reach system health endpoint: {state.err}
      </div>
    );
  }

  const p = state.payload!;
  const issues: string[] = [];
  if (p.db !== 'connected') {
    if (p.db_hint === 'rls_blocks_anon_add_service_role') {
      issues.push(
        'Database: add SUPABASE_SERVICE_ROLE_KEY in .env.local (Supabase → Settings → API → service_role secret). Health check reads `orders` without a user session; anon key is blocked by RLS.'
      );
    } else if (p.db_hint === 'invalid_or_unauthorized_key') {
      issues.push(
        'Database: wrong URL or API key — copy Project URL + anon (or publishable) key from Supabase → Settings → API.'
      );
    } else if (p.db === 'missing_table' || p.db_hint === 'missing_orders_table') {
      issues.push('Database: `orders` table missing — run supabase migrations (see QUICK_APPLY_014_015_017.sql).');
    } else if (p.db_hint === 'missing_env') {
      issues.push('Database: missing NEXT_PUBLIC_SUPABASE_URL or anon key.');
    } else {
      issues.push(
        `Database: ${p.db ?? 'error'}${p.db_detail ? ` — ${p.db_detail}` : ''}`
      );
    }
  }
  if (p.storage === 'missing_env') issues.push('Supabase env vars missing');
  if (p.imap_app_credentials === 'missing_table') issues.push('IMAP table missing (run migration 015/017)');
  if (p.imap_env?.encryption_key === 'missing') issues.push('IMAP encryption key missing (GMAIL_IMAP_ENCRYPTION_KEY)');
  if (p.imap_env?.service_role === 'missing') issues.push('Service role key missing (SUPABASE_SERVICE_ROLE_KEY)');
  if (p.imap_env?.cron_secret === 'missing') issues.push('Cron secret missing (CRON_SECRET)');

  if (issues.length === 0) return null;

  return (
    <div
      role="status"
      className="mt-4 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
    >
      <span className="font-medium text-amber-50">System check: </span>
      {issues.join(' · ')}
    </div>
  );
}
