/**
 * Heuristic extraction of order fields from parsed MIME mail (mailparser).
 * Merchant templates change — extend regexes as you collect samples.
 */

import type { ParsedMail } from 'mailparser';

export type OrderProvider = 'amazon' | 'uber' | 'uber_eats' | 'doordash' | 'other';

export type ParsedImapOrder = {
  provider: OrderProvider;
  order_id: string | null;
  order_date: Date | null;
  promised_delivery_time: Date | null;
  actual_delivery_time: Date | null;
  order_value_cents: number | null;
  currency: string;
  merchant_name: string | null;
  email_message_id: string | null;
  email_subject: string | null;
  email_from: string | null;
  raw_email: Record<string, unknown>;
};

const US_DATE = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/;
const ISO_DT =
  /\b(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/;
const MONEY = /\$\s*([\d,]+(?:\.\d{2})?)/;
const AMAZON_ORDER = /\b(\d{3}-\d{7}-\d{7})\b/;
const GENERIC_ORDER = /\b(?:order|confirmation)\s*#?\s*([A-Z0-9-]{6,32})\b/i;

function firstAddress(from: ParsedMail['from']): string {
  if (!from?.value?.length) return '';
  const v = from.value[0];
  return `${v.name || ''} <${v.address}>`.trim() || v.address || '';
}

function addressOnly(from: ParsedMail['from']): string {
  return from?.value?.[0]?.address?.toLowerCase() ?? '';
}

function inferProvider(fromAddr: string, subject: string, text: string): OrderProvider {
  const a = fromAddr.toLowerCase();
  const sub = subject.toLowerCase();
  const blob = `${sub} ${text.slice(0, 4000)}`.toLowerCase();
  if (a.includes('amazon') || a.includes('amzn')) return 'amazon';
  if (a.includes('doordash')) return 'doordash';
  if (a.includes('uber')) {
    if (/\beats\b|uber\s*eats|your order from/i.test(blob)) return 'uber_eats';
    return 'uber';
  }
  return 'other';
}

function parseMoney(text: string): { cents: number; currency: string } | null {
  const m = text.match(MONEY);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  if (Number.isNaN(n)) return null;
  return { cents: Math.round(n * 100), currency: 'USD' };
}

function tryParseDate(text: string): Date | null {
  const iso = text.match(ISO_DT);
  if (iso) {
    const y = +iso[1],
      mo = +iso[2],
      d = +iso[3],
      H = +iso[4],
      Mi = +iso[5];
    const dt = new Date(y, mo - 1, d, H, Mi, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const us = text.match(US_DATE);
  if (us) {
    let mo = +us[1],
      d = +us[2],
      y = +us[3];
    if (y < 100) y += 2000;
    const dt = new Date(y, mo - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

function extractOrderId(provider: OrderProvider, text: string): string | null {
  if (provider === 'amazon') {
    const m = text.match(AMAZON_ORDER);
    if (m) return m[1];
  }
  const g = text.match(GENERIC_ORDER);
  if (g) return g[1];
  return null;
}

/**
 * If both promised and actual exist and actual is more than 15 minutes after promised,
 * we treat as delay (same threshold as product spec).
 */
export function isDelayedOverMinutes(
  promised: Date | null,
  actual: Date | null,
  minutes: number
): boolean {
  if (!promised || !actual) return false;
  return actual.getTime() - promised.getTime() > minutes * 60 * 1000;
}

export function parseMailToOrder(parsed: ParsedMail): ParsedImapOrder {
  const fromStr = firstAddress(parsed.from);
  const fromEmail = addressOnly(parsed.from);
  const subject = parsed.subject ?? '';
  const text = [parsed.text || '', stripHtml(parsed.html || '')].join('\n');
  const provider = inferProvider(fromEmail, subject, text);

  const order_id = extractOrderId(provider, text);

  // Scan for datetime-like strings (first = order-ish, look for delivery keywords)
  let order_date: Date | null = tryParseDate(text.slice(0, 500));
  let promised_delivery_time: Date | null = null;
  let actual_delivery_time: Date | null = null;

  const lower = text.toLowerCase();
  const deliveryIdx = lower.search(
    /delivered|arrived|estimated delivery|expected delivery|delivery time|arriving/
  );
  const window = deliveryIdx >= 0 ? text.slice(deliveryIdx, deliveryIdx + 800) : text;

  if (/delivered|arrived by|was delivered/i.test(window)) {
    actual_delivery_time = tryParseDate(window) ?? actual_delivery_time;
  }
  if (/expected|estimated|arriving by|delivery window|by \d/i.test(window)) {
    promised_delivery_time = tryParseDate(window) ?? promised_delivery_time;
  }

  if (!promised_delivery_time && !actual_delivery_time) {
    const d = tryParseDate(text);
    if (d) order_date = d;
  }

  const money = parseMoney(text);

  const messageId =
    typeof parsed.messageId === 'string' && parsed.messageId.trim()
      ? parsed.messageId.trim()
      : null;

  return {
    provider,
    order_id,
    order_date,
    promised_delivery_time,
    actual_delivery_time,
    order_value_cents: money?.cents ?? null,
    currency: money?.currency ?? 'USD',
    merchant_name:
      provider === 'amazon'
        ? 'Amazon'
        : provider === 'doordash'
          ? 'DoorDash'
          : provider === 'uber_eats'
            ? 'Uber Eats'
            : 'Uber',
    email_message_id: messageId,
    email_subject: subject || null,
    email_from: fromStr || null,
    raw_email: {
      source: 'imap_cron',
      message_id: messageId,
      subject,
      text_preview: text.slice(0, 2500),
    },
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
