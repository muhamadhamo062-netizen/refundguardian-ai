'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch (error) {
        // Silent failure – PWA features just won’t be available.
        console.error('Service worker registration failed', error);
      }
    };

    // Delay registration slightly so it doesn't compete with critical rendering.
    const timeout = window.setTimeout(register, 1500);
    return () => window.clearTimeout(timeout);
  }, []);

  return null;
}

