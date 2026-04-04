/**
 * Gmail X-GM-RAW search string: transactional senders for receipts / delivery updates.
 * Keep aligned with product copy (Amazon, Uber, DoorDash).
 */
/** Broaden senders slightly — merchant templates vary; parser still classifies by From + body. */
export const GMAIL_IMAP_RAW_QUERY =
  '(from:auto-confirm@amazon.com OR from:order-update@amazon.com OR from:no-reply@uber.com OR from:receipts@uber.com OR from:noreply@doordash.com OR from:no-reply@doordash.com)';

/** Max messages to fetch per user per cron run (limits serverless runtime). */
export const IMAP_MAX_MESSAGES_PER_USER = 40;
