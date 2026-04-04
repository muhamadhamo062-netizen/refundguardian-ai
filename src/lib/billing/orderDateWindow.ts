/**
 * Free-trial order window: recent orders only (default last 3 calendar days).
 */

export const FREE_TRIAL_ORDER_DAYS = 3;

/** Best-effort parse for extension/API date strings. */
export function parseOrderDateUtc(s: string | null | undefined): Date | null {
  if (!s || s === '—') return null;
  const trimmed = s.trim();
  const t = Date.parse(trimmed);
  if (!Number.isNaN(t)) return new Date(t);

  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    const mm = parseInt(mdy[1], 10);
    const dd = parseInt(mdy[2], 10);
    let yy = parseInt(mdy[3], 10);
    if (yy < 100) yy += yy >= 70 ? 1900 : 2000;
    const d = new Date(Date.UTC(yy, mm - 1, dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export function isOrderWithinFreeTrialWindow(
  orderDateRaw: string | null | undefined,
  days: number = FREE_TRIAL_ORDER_DAYS
): boolean {
  const d = parseOrderDateUtc(orderDateRaw ?? undefined);
  if (!d) return false;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days);
  return d >= cutoff;
}
