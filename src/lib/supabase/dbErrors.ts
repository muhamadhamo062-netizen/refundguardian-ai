/**
 * Classify Supabase/PostgREST errors for the `orders` table.
 */
export function isOrdersRelationMissingError(err: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = err.code || '';
  if (code === '42P01') return true;
  if (msg.includes('does not exist') && (msg.includes('orders') || msg.includes('relation'))) return true;
  if (msg.includes('schema cache') && msg.includes('orders')) return true;
  return false;
}

export function ordersTableMissingResponse() {
  return {
    ok: false as const,
    error: 'orders table missing' as const,
    db: 'missing_table' as const,
  };
}

export function isCompensationEventsMissingError(err: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = err.code || '';
  if (code === '42P01') return true;
  if (msg.includes('does not exist') && msg.includes('compensation_events')) return true;
  if (msg.includes('schema cache') && msg.includes('compensation_events')) return true;
  return false;
}

export function isExtensionSyncTableMissingError(err: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = err.code || '';
  if (code === '42P01') return true;
  if (msg.includes('does not exist') && msg.includes('extension_sync_events')) return true;
  if (msg.includes('schema cache') && msg.includes('extension_sync_events')) return true;
  return false;
}
