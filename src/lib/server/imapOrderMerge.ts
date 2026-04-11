import type { OrderProvider, ParsedImapOrder } from '@/lib/server/parseImapOrderEmail';

export type ParsedMessageRow = {
  draft: ParsedImapOrder;
  /** Best-effort message time (parsed email Date header / body). */
  internalDate: Date;
};

function stableKey(provider: OrderProvider, orderId: string): string {
  return `${provider}\0${orderId.trim()}`;
}

/**
 * Merge multiple emails (order confirmation + delivery confirmation) into one logical order per merchant order id.
 * - Promised time: first non-null from order-style emails in chronological order.
 * - Actual delivery: last delivery-style email (body time, else email sent time).
 */
export function mergeParsedOrdersByMerchantId(rows: ParsedMessageRow[]): Map<string, ParsedImapOrder> {
  const groups = new Map<string, ParsedMessageRow[]>();

  for (const r of rows) {
    const oid = r.draft.order_id?.trim();
    if (!oid || oid.length < 3) continue;
    const key = stableKey(r.draft.provider, oid);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const out = new Map<string, ParsedImapOrder>();

  for (const [key, list] of groups) {
    list.sort((a, b) => a.internalDate.getTime() - b.internalDate.getTime());

    let promised: Date | null = null;
    let actual: Date | null = null;
    let bestMessageId: string | null = null;

    for (const r of list) {
      const k = r.draft.email_kind;
      if (k === 'order_confirmation' || k === 'unknown') {
        if (!promised && r.draft.promised_delivery_time) {
          promised = r.draft.promised_delivery_time;
          bestMessageId = r.draft.email_message_id ?? bestMessageId;
        }
      }
    }
    if (!promised) {
      for (const r of list) {
        if (r.draft.promised_delivery_time) {
          promised = r.draft.promised_delivery_time;
          bestMessageId = r.draft.email_message_id ?? bestMessageId;
          break;
        }
      }
    }

    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i];
      if (r.draft.email_kind === 'delivery_confirmation') {
        actual = r.draft.actual_delivery_time ?? r.draft.email_sent_at ?? r.internalDate;
        bestMessageId = r.draft.email_message_id ?? bestMessageId;
        break;
      }
    }
    if (!actual) {
      for (let i = list.length - 1; i >= 0; i--) {
        const r = list[i];
        if (r.draft.actual_delivery_time) {
          actual = r.draft.actual_delivery_time;
          bestMessageId = r.draft.email_message_id ?? bestMessageId;
          break;
        }
      }
    }
    if (!actual) {
      for (let i = list.length - 1; i >= 0; i--) {
        const r = list[i];
        if (r.draft.email_kind === 'delivery_confirmation' && r.draft.email_sent_at) {
          actual = r.draft.email_sent_at;
          bestMessageId = r.draft.email_message_id ?? bestMessageId;
          break;
        }
      }
    }

    const last = list[list.length - 1];
    const base = last.draft;
    out.set(key, {
      ...base,
      promised_delivery_time: promised ?? base.promised_delivery_time,
      actual_delivery_time: actual ?? base.actual_delivery_time,
      email_message_id: bestMessageId ?? base.email_message_id,
      order_date: list[0].draft.order_date ?? base.order_date,
      raw_email: {
        ...((base.raw_email as object) || {}),
        merge_sources: list.length,
        merged_key: key,
      },
    });
  }

  return out;
}
