/**
 * Server-only Paddle catalog mapping (price IDs from Paddle Dashboard → Catalog).
 */
export function getPaddlePriceIds(): { monthly: string | null; annual: string | null } {
  return {
    monthly: process.env.PADDLE_PRICE_MONTHLY?.trim() ?? null,
    annual: process.env.PADDLE_PRICE_ANNUAL?.trim() ?? null,
  };
}

export function planFromPaddlePriceId(priceId: string | undefined): 'monthly' | 'annual' {
  const { monthly, annual } = getPaddlePriceIds();
  if (priceId && annual && priceId === annual) return 'annual';
  if (priceId && monthly && priceId === monthly) return 'monthly';
  return 'monthly';
}
