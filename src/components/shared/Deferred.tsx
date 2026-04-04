'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * Defers rendering heavy client components until after first paint / idle time.
 * Improves perceived navigation speed to dashboard on low-end devices.
 */
export function Deferred({
  children,
  delayMs = 0,
  fallback = null,
}: {
  children: ReactNode;
  delayMs?: number;
  fallback?: ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const cb = () => {
      if (cancelled) return;
      setReady(true);
    };

    // Keep deferral short: long idle timeouts felt like “blank until second tap” on mobile.
    const id =
      typeof w.requestIdleCallback === 'function'
        ? w.requestIdleCallback(cb, { timeout: 200 })
        : window.setTimeout(cb, delayMs);

    return () => {
      cancelled = true;
      if (typeof id === 'number' && typeof w.requestIdleCallback === 'function' && typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(id);
      }
      if (typeof id === 'number' && typeof w.requestIdleCallback !== 'function') {
        window.clearTimeout(id);
      }
    };
  }, [delayMs]);

  if (!ready) return <>{fallback}</>;
  return <>{children}</>;
}

