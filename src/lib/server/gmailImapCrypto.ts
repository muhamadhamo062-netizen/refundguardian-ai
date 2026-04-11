/**
 * Server-only AES-256-GCM helpers for Gmail App Passwords at rest.
 * Import only from Route Handlers / Server Actions — never from client components.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
/** Legacy salt — do not change (would invalidate stored encrypted IMAP passwords). */
const KDF_SALT = 'refundguardian-imap-v1';

function deriveKey(): Buffer {
  const secret = process.env.GMAIL_IMAP_ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error(
      'GMAIL_IMAP_ENCRYPTION_KEY is missing or too short. Set a long random secret in env (server only).'
    );
  }
  return scryptSync(secret, KDF_SALT, 32);
}

/** Returns base64(iv || tag || ciphertext) suitable for a single TEXT column. */
export function encryptAppPassword(plain: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptAppPassword(bundleB64: string): string {
  const key = deriveKey();
  const buf = Buffer.from(bundleB64, 'base64');
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('Invalid ciphertext');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
