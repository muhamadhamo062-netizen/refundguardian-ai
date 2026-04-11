/**
 * Gmail X-GM-RAW search string: transactional senders for receipts / delivery updates.
 * `newer_than` scopes how far back mobile IMAP sync reads (default 14 days).
 */

/** Broad merchant From: addresses — parser classifies by body + subject. */
const GMAIL_FROM_CLAUSE =
  '(from:auto-confirm@amazon.com OR from:order-update@amazon.com OR from:shipment-tracking@amazon.com OR from:no-reply@uber.com OR from:receipts@uber.com OR from:noreply@doordash.com OR from:no-reply@doordash.com)';

/** Max messages to fetch per user per run (serverless-safe upper bound). */
export const IMAP_MAX_MESSAGES_DEFAULT = 150;

/** First mobile connect + manual “Scan now” — deeper history window. */
export const IMAP_MAX_MESSAGES_DEEP = 220;

export function buildGmailImapRawQuery(daysBack = 14): string {
  const d = Math.min(Math.max(daysBack, 1), 365);
  return `${GMAIL_FROM_CLAUSE} newer_than:${d}d`;
}

/** @deprecated use buildGmailImapRawQuery() */
export const GMAIL_IMAP_RAW_QUERY = buildGmailImapRawQuery(14);
