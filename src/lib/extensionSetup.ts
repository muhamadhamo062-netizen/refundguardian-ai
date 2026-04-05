/**
 * US-only merchant **order** surfaces opened from the dashboard (Install / Connect flow).
 * Open order (seed tabs) — **exact sequence**:
 * 1. Amazon (Your Orders / Order History)
 * 2. Uber Eats → Orders
 * 3. Uber Rides → Trips
 * 4. DoorDash → Orders
 *
 * These URLs are the single source of truth for `openMerchantSeedTabs()` in ExtensionToken.tsx.
 */
export const MERCHANT_SEED_URLS = [
  {
    key: 'amazon' as const,
    /**
     * Order History (Your Orders) — canonical list view. Prefer this over `/gp/your-orders`, which can
     * bounce to `https://www.amazon.com/` when cookies/session are odd. Still not the bare homepage.
     */
    url: 'https://www.amazon.com/gp/css/order-history',
    label: 'Amazon',
  },
  {
    key: 'ubereats' as const,
    url: 'https://www.ubereats.com/orders',
    label: 'Uber Eats',
  },
  {
    key: 'uber' as const,
    /** Global English trips surface (Uber may redirect from `/trips`); matches user-facing “Trips”. */
    url: 'https://www.uber.com/global/en/trips',
    label: 'Uber Rides',
  },
  {
    key: 'doordash' as const,
    url: 'https://www.doordash.com/orders',
    label: 'DoorDash',
  },
] as const;

export function getChromeWebStoreUrl(): string | null {
  const u = process.env.NEXT_PUBLIC_CHROME_WEB_STORE_URL;
  if (typeof u === 'string' && u.trim().length > 0) return u.trim();
  return null;
}
