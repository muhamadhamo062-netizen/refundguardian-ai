'use client';

import { useEffect } from 'react';

/** After Gmail save we reload with ?sync=1 — scroll to orders and drop the param from the URL. */
export function DashboardSyncScroll() {
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('sync') !== '1') return;
    requestAnimationFrame(() => {
      document.getElementById('dashboard-orders')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    p.delete('sync');
    const qs = p.toString();
    const path = window.location.pathname;
    window.history.replaceState({}, '', qs ? `${path}?${qs}` : path);
  }, []);
  return null;
}
