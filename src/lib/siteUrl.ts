/**
 * Canonical public origin for redirects, emails, and API callbacks.
 *
 * Priority:
 * 1. `NEXT_PUBLIC_SITE_URL` (set to `http://localhost:3000` in `.env.local` for local dev)
 * 2. `VERCEL_URL` on Vercel deployments
 * 3. {@link DEFAULT_SITE_ORIGIN} — always `http://localhost:3000` (npm run dev default port)
 */
export const DEFAULT_SITE_ORIGIN = 'http://localhost:3000';

export function getPublicSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel}`.replace(/\/$/, '');
  }
  return DEFAULT_SITE_ORIGIN;
}
