/**
 * Heuristic extraction of order fields from parsed MIME mail (mailparser).
 * Merchant templates change — extend regexes as you collect samples.
 *
 * Supports pairing **Order confirmation** (promised delivery) with **Delivery confirmation**
 * (actual arrival) via `imapOrderMerge` + stable merchant `order_id`.
 */

import type { ParsedMail } from 'mailparser';

export type OrderProvider = 'amazon' | 'uber' | 'uber_eats' | 'doordash' | 'other';

export type EmailKind = 'order_confirmation' | 'delivery_confirmation' | 'unknown';

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
  /** Heuristic classification for merge (confirmation vs delivered). */
  email_kind: EmailKind;
  /** Email Date header — used as fallback “arrival” time for delivery emails. */
  email_sent_at: Date | null;
  raw_email: Record<string, unknown>;
};

const US_DATE = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/;
const ISO_DT =
  /\b(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/;
/** e.g. "by 9:15 PM", "by 8:00 pm" */
const TIME_BY = /\bby\s+(\d{1,2}):(\d{2})\s*(am|pm)\b/i;
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
  const tb = text.match(TIME_BY);
  if (tb) {
    let h = +tb[1];
    const mi = +tb[2];
    const ap = tb[3].toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    const now = new Date();
    const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, mi, 0, 0);
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

function classifyEmailKind(subject: string, text: string): EmailKind {
  const s = subject.toLowerCase();
  const t = text.slice(0, 12000).toLowerCase();

  const delivery =
    /your order has been delivered|has been delivered|was delivered to|successfully delivered|delivered on|delivered at|order delivered|left near your|handed off|enjoy your food|enjoy your order|delivery complete/i.test(
      s
    ) ||
    /your order has been delivered|has been delivered|was delivered|successfully delivered|delivered on|delivered at|order delivered|left at your|handed to you|delivery from your/i.test(
      t
    );

  const orderConfirm =
    /order confirmation|thanks for your order|thank you for ordering|your order (#|number|with)|order placed|we received your order|order summary|successfully placed/i.test(
      s
    ) ||
    /order confirmation|thank you for your order|your order has been received|placed successfully/i.test(t);

  if (delivery && !orderConfirm) return 'delivery_confirmation';
  if (orderConfirm && !delivery) return 'order_confirmation';
  if (delivery) return 'delivery_confirmation';
  if (orderConfirm) return 'order_confirmation';
  return 'unknown';
}

/**
 * Pull promised window from order / shipping copy; actual from delivered copy.
 */
function extractDeliveryTimes(
  kind: EmailKind,
  text: string,
  emailSentAt: Date | null
): { promised: Date | null; actual: Date | null } {
  let promised: Date | null = null;
  let actual: Date | null = null;
  const lower = text.toLowerCase();

  const promisedRegion = (() => {
    const idx = lower.search(
      /expected delivery|estimated delivery|arriving|delivery window|delivery by|scheduled delivery|promised|arrives by|eta|delivery on|track package|out for delivery/
    );
    return idx >= 0 ? text.slice(idx, idx + 1200) : text.slice(0, 2500);
  })();

  const deliveredRegion = (() => {
    const idx = lower.search(
      /delivered|arrived|was delivered|delivery complete|handed off|left at your|your order has been delivered/
    );
    return idx >= 0 ? text.slice(idx, idx + 1200) : text;
  })();

  if (kind === 'delivery_confirmation' || /delivered|was delivered|has been delivered/i.test(lower)) {
    const fromBody = tryParseDate(deliveredRegion);
    actual = fromBody ?? emailSentAt;
  }

  if (kind === 'order_confirmation' || kind === 'unknown') {
    const m1 = tryParseDate(promisedRegion);
    if (m1) promised = m1;
    if (!promised) {
      const m2 = tryParseDate(text.slice(0, 3500));
      if (m2) promised = m2;
    }
  }

  if (kind === 'delivery_confirmation' && !actual && emailSentAt) {
    actual = emailSentAt;
  }

  return { promised, actual };
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

/** Any lateness vs promised window (strictly after promised instant). */
export function isOrderLateForRefundStatus(promised: Date | null, actual: Date | null): boolean {
  if (!promised || !actual) return false;
  return actual.getTime() > promised.getTime();
}

export function parseMailToOrder(parsed: ParsedMail): ParsedImapOrder {
  const fromStr = firstAddress(parsed.from);
  const fromEmail = addressOnly(parsed.from);
  const subject = parsed.subject ?? '';
  const text = [parsed.text || '', stripHtml(parsed.html || '')].join('\n');
  const provider = inferProvider(fromEmail, subject, text);

  const order_id = extractOrderId(provider, text);
  const email_kind = classifyEmailKind(subject, text);
  const email_sent_at =
    parsed.date && !Number.isNaN(parsed.date.getTime()) ? new Date(parsed.date.getTime()) : null;

  let order_date: Date | null = tryParseDate(text.slice(0, 500));
  const { promised: promised_delivery_time, actual: actual_delivery_time } = extractDeliveryTimes(
    email_kind,
    text,
    email_sent_at
  );

  if (!order_date) {
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
            : provider === 'uber'
              ? 'Uber'
              : 'Merchant',
    email_message_id: messageId,
    email_subject: subject || null,
    email_from: fromStr || null,
    email_kind,
    email_sent_at,
    raw_email: {
      source: 'imap_cron',
      message_id: messageId,
      subject,
      email_kind,
      text_preview: text.slice(0, 2500),
    },
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
