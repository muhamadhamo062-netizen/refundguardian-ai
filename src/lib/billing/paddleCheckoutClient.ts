'use client';

/**
 * Paddle Billing overlay checkout — loads the official script from CDN (no `@paddle/paddle-js` npm dep).
 * @see https://developer.paddle.com/paddlejs/overview
 */

const PADDLE_SCRIPT_SRC = 'https://cdn.paddle.com/paddle/v2/paddle.js';

type PaddleGlobal = {
  Initialize: (opts: { token: string; environment: 'sandbox' | 'production' }) => Promise<void>;
  Checkout: {
    open: (opts: {
      items: { priceId: string; quantity: number }[];
      customer?: { email: string };
      customData?: Record<string, string>;
    }) => void;
  };
};

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

function clientToken(): string {
  return process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim() ?? '';
}

function environment(): 'sandbox' | 'production' {
  return process.env.NEXT_PUBLIC_PADDLE_ENV?.trim() === 'production' ? 'production' : 'sandbox';
}

let scriptReady: Promise<void> | null = null;

function loadPaddleScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Paddle checkout must run in the browser'));
  }
  if (window.Paddle?.Initialize) {
    return Promise.resolve();
  }
  if (!scriptReady) {
    scriptReady = new Promise((resolve, reject) => {
      if (document.getElementById('paddle-js-sdk')) {
        waitForGlobal().then(resolve).catch(reject);
        return;
      }
      const el = document.createElement('script');
      el.id = 'paddle-js-sdk';
      el.src = PADDLE_SCRIPT_SRC;
      el.async = true;
      el.onload = () => void waitForGlobal().then(resolve).catch(reject);
      el.onerror = () => reject(new Error('Failed to load Paddle.js from CDN'));
      document.head.appendChild(el);
    });
  }
  return scriptReady;
}

function waitForGlobal(): Promise<void> {
  if (window.Paddle?.Initialize) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let n = 0;
    const id = window.setInterval(() => {
      if (window.Paddle?.Initialize) {
        window.clearInterval(id);
        resolve();
        return;
      }
      if (++n > 120) {
        window.clearInterval(id);
        reject(new Error('Paddle global not available after script load'));
      }
    }, 50);
  });
}

let initDone: Promise<void> | null = null;

function ensureInitialized(): Promise<void> {
  const token = clientToken();
  if (!token) {
    return Promise.reject(new Error('Paddle is not configured (set NEXT_PUBLIC_PADDLE_CLIENT_TOKEN).'));
  }
  if (!initDone) {
    initDone = (async () => {
      await loadPaddleScript();
      const P = window.Paddle;
      if (!P?.Initialize) {
        throw new Error('Paddle.Initialize is not available');
      }
      await P.Initialize({
        token,
        environment: environment(),
      });
    })();
  }
  return initDone;
}

export type PaddleCheckoutPayload = {
  priceId: string;
  customerEmail: string | null;
  customData: Record<string, string>;
};

/** Opens Paddle overlay checkout (subscriptions). */
export async function openPaddleSubscriptionCheckout(payload: PaddleCheckoutPayload): Promise<void> {
  await ensureInitialized();
  const P = window.Paddle;
  if (!P?.Checkout?.open) {
    throw new Error('Paddle Checkout is not available');
  }
  P.Checkout.open({
    items: [{ priceId: payload.priceId, quantity: 1 }],
    customer: payload.customerEmail ? { email: payload.customerEmail } : undefined,
    customData: payload.customData,
  });
}
