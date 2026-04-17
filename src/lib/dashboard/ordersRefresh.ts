/** Fired after Gmail/IMAP credentials save so the orders table refetches immediately. */
export const DASHBOARD_ORDERS_REFRESH_EVENT = 'refyndra:dashboard-orders-refresh';

export function dispatchDashboardOrdersRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DASHBOARD_ORDERS_REFRESH_EVENT));
}
