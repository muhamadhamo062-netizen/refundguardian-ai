import { Environment, Paddle } from '@paddle/paddle-node-sdk';

function paddleEnvironment(): Environment {
  return process.env.NEXT_PUBLIC_PADDLE_ENV?.trim() === 'production'
    ? Environment.production
    : Environment.sandbox;
}

/** Server-side Paddle Billing API client. Requires `PADDLE_API_KEY`. */
export function getPaddleServer(): Paddle | null {
  const key = process.env.PADDLE_API_KEY?.trim();
  if (!key) return null;
  return new Paddle(key, { environment: paddleEnvironment() });
}
