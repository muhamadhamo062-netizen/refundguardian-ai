'use client';

import { initializePaddle } from '@paddle/paddle-js';
import type { Environments, Paddle } from '@paddle/paddle-js';

function clientToken(): string {
  return process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim() ?? '';
}

function environment(): Environments {
  return process.env.NEXT_PUBLIC_PADDLE_ENV?.trim() === 'production' ? 'production' : 'sandbox';
}

let paddleInit: Promise<Paddle | undefined> | null = null;

async function getPaddle(): Promise<Paddle> {
  const token = clientToken();
  if (!token) {
    throw new Error('Paddle is not configured (set NEXT_PUBLIC_PADDLE_CLIENT_TOKEN).');
  }
  if (!paddleInit) {
    paddleInit = initializePaddle({ token, environment: environment() });
  }
  const paddle = await paddleInit;
  if (!paddle?.Checkout?.open) {
    throw new Error('Paddle Checkout is not available');
  }
  return paddle;
}

export type PaddleCheckoutPayload = {
  priceId: string;
  customerEmail: string | null;
  customData: Record<string, string>;
};

/** Opens Paddle overlay checkout (subscriptions) via `@paddle/paddle-js`. */
export async function openPaddleSubscriptionCheckout(payload: PaddleCheckoutPayload): Promise<void> {
  const paddle = await getPaddle();
  paddle.Checkout.open({
    items: [{ priceId: payload.priceId, quantity: 1 }],
    customer: payload.customerEmail ? { email: payload.customerEmail } : undefined,
    customData: payload.customData,
  });
}
