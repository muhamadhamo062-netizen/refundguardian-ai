'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * Defers rendering heavy client components until after first paint / idle time.
 * Improves perceived navigation speed to dashboard on low-end devices.
 */
export function Deferred({
  children,
  delayMs = 350,
  fallback = null,
}: {
  children: ReactNode;
  delayMs?: number;
  fallback?: ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    const cb = () => {
      if (cancelled) return;
      setReady(true);
    };

    // Prefer idle callback when available; fall back to a short timeout.
    const id =
      typeof w.requestIdleCallback === 'function'
        ? w.requestIdleCallback(cb, { timeout: 1200 })
        : window.setTimeout(cb, delayMs);

    return () => {
      cancelled = true;
      if (typeof id === 'number' && typeof w.requestIdleCallback === 'function') {
        // No reliable cancelIdleCallback typing here; timeout fallback is fine.
      }
      if (typeof id === 'number' && typeof w.requestIdleCallback !== 'function') {
        window.clearTimeout(id);
      }
    };
  }, [delayMs]);

  if (!ready) return <>{fallback}</>;
  return <>{children}</>;
}

