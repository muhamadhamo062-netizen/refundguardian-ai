import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies Paddle `Paddle-Signature` header (HMAC-SHA256 over `ts:rawBody`).
 * Secret is the notification destination secret from Paddle (not the API key).
 */
export function verifyPaddleWebhookSignature(
  rawBody: string,
  paddleSignatureHeader: string | null,
  secret: string
): boolean {
  if (!paddleSignatureHeader || !secret) return false;
  let ts = '';
  let h1 = '';
  for (const part of paddleSignatureHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key === 'ts') ts = val;
    if (key === 'h1') h1 = val;
  }
  if (!ts || !h1) return false;

  const signedPayload = `${ts}:${rawBody}`;
  const expectedHex = createHmac('sha256', secret).update(signedPayload).digest('hex');

  try {
    const a = Buffer.from(expectedHex, 'hex');
    const b = Buffer.from(h1, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
