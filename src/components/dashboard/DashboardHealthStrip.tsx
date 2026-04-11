'use client';

import { useEffect, useState } from 'react';

type HealthPayload = {
  ok?: boolean;
  db?: string;
  db_hint?: string;
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
 * Surfaces connectivity issues in plain language (no env names or internal IDs).
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
          err: e instanceof Error ? e.message : 'Connection check failed',
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
        We couldn’t verify your connection. Check your network and try refreshing the page.
      </div>
    );
  }

  const p = state.payload!;
  const issues: string[] = [];
  if (p.db !== 'connected') {
    issues.push('We’re having trouble loading your saved activity. Try again in a few minutes.');
  }
  if (p.storage === 'missing_env') issues.push('App configuration is incomplete. Please contact support if this continues.');
  if (p.imap_app_credentials === 'missing_table') issues.push('Email backup features aren’t ready on this account yet.');
  if (p.imap_env?.encryption_key === 'missing') issues.push('Secure email backup isn’t fully configured.');
  if (p.imap_env?.service_role === 'missing') issues.push('Some background features may be limited until setup is finished.');
  if (p.imap_env?.cron_secret === 'missing') issues.push('Scheduled email checks may not run until setup is complete.');

  if (issues.length === 0) return null;

  return (
    <div
      role="status"
      className="mt-4 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
    >
      <span className="font-medium text-amber-50">Heads up: </span>
      {issues.join(' ')}
    </div>
  );
}
