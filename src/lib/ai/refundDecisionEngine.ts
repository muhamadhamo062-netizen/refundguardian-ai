import OpenAI from 'openai';
import type {
  RefundDecisionInput,
  RefundDecisionOutput,
  RefundDecisionWithKey,
} from '@/lib/ai/refundDecision.types';
import { generateComplaintForRefundOrder } from '@/lib/ai/complaintGenerator';
import type { RefundIssueType, RefundPlatform } from '@/lib/refundPriorityEngine';

export type {
  RefundDecisionInput,
  RefundDecisionOutput,
  RefundDecisionWithKey,
} from '@/lib/ai/refundDecision.types';

/**
 * Advisory-only AI layer: suggests scores, labels, estimates, and draft claim text.
 * Does not execute refunds or contact merchants.
 */

function normalizePriority(v: string): RefundDecisionOutput['priority'] {
  const s = v.toUpperCase();
  if (s.includes('HIGH')) return 'HIGH VALUE';
  if (s.includes('FAST')) return 'FAST';
  return 'MEDIUM';
}

function clampScore(n: unknown): number {
  const x = typeof n === 'number' ? n : Number(n);
  if (Number.isNaN(x)) return 50;
  return Math.min(100, Math.max(0, Math.round(x)));
}

function asRefundPlatform(p: string): RefundPlatform {
  if (p === 'amazon' || p === 'uber_eats' || p === 'uber_rides' || p === 'doordash') return p;
  return 'amazon';
}

function asRefundIssueType(t: string): RefundIssueType {
  switch (t) {
    case 'missing_item':
    case 'charged_incorrectly':
    case 'late_delivery':
    case 'trip_issue':
    case 'quality_issue':
    case 'unknown':
      return t;
    default:
      return 'unknown';
  }
}

async function enrichWithComplaintGenerator(
  inputs: RefundDecisionInput[],
  map: Map<string, RefundDecisionOutput>
): Promise<Map<string, RefundDecisionOutput>> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const out = new Map<string, RefundDecisionOutput>();
    for (const [id, dec] of map) {
      out.set(id, {
        ...dec,
        ai_complaint: dec.claim_message,
        complaint_status: dec.claim_message?.trim() ? 'template' : 'unavailable',
      });
    }
    return out;
  }

  const entries = [...map.entries()];
  const concurrency = 4;
  const next = new Map<string, RefundDecisionOutput>();

  for (let i = 0; i < entries.length; i += concurrency) {
    const slice = entries.slice(i, i + concurrency);
    await Promise.all(
      slice.map(async ([id, dec]) => {
        const inp = inputs.find((x) => x.id === id);
        if (!inp) {
          next.set(id, dec);
          return;
        }
        try {
          const text = await generateComplaintForRefundOrder({
            platform: asRefundPlatform(String(inp.platform)),
            issue_type: asRefundIssueType(String(inp.issue_type)),
            order_id: inp.order_id,
            productName: inp.product_name ?? undefined,
          });
          next.set(id, {
            ...dec,
            claim_message: text,
            ai_complaint: text,
            complaint_status: 'ai',
          });
        } catch {
          next.set(id, {
            ...dec,
            ai_complaint: dec.claim_message,
            complaint_status: dec.claim_message?.trim() ? 'template' : 'unavailable',
          });
        }
      })
    );
  }
  return next;
}

function clampConfidence(n: unknown, fallback: number): number {
  const x = typeof n === 'number' ? n : Number(n);
  if (Number.isNaN(x)) return Math.min(100, Math.max(0, Math.round(fallback)));
  return Math.min(100, Math.max(0, Math.round(x)));
}

function safeEstimated(n: unknown): number {
  const x = typeof n === 'number' ? n : Number(n);
  if (Number.isNaN(x) || x < 0) return 0;
  return Math.round(x * 100) / 100;
}

function parseDecisionJson(
  text: string,
  inputs: RefundDecisionInput[]
): Map<string, RefundDecisionOutput> {
  const map = new Map<string, RefundDecisionOutput>();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as { decisions?: unknown };
  } catch {
    return map;
  }
  const decisions = (parsed as { decisions?: Array<Record<string, unknown>> }).decisions;
  if (!Array.isArray(decisions)) return map;

  const byOrderId = new Map(inputs.map((i) => [i.order_id, i.id]));

  for (const d of decisions) {
    const oid = typeof d.order_id === 'string' ? d.order_id : '';
    const clientId = byOrderId.get(oid);
    if (!clientId) continue;
    const refund_score = clampScore(d.refund_score);
    map.set(clientId, {
      refund_score,
      priority: normalizePriority(String(d.priority ?? 'MEDIUM')),
      estimated_refund: safeEstimated(d.estimated_refund),
      reason: typeof d.reason === 'string' ? d.reason : '',
      claim_message: typeof d.claim_message === 'string' ? d.claim_message : '',
      confidence: clampConfidence(d.confidence, refund_score),
    });
  }
  return map;
}

/**
 * Batch advisory analysis via OpenAI (JSON-only response).
 */
export async function analyzeRefundDecisions(
  inputs: RefundDecisionInput[]
): Promise<Map<string, RefundDecisionOutput>> {
  const empty = new Map<string, RefundDecisionOutput>();
  if (inputs.length === 0) return empty;

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    console.warn('[refundDecisionEngine] OPENAI_API_KEY missing — skipping AI analysis');
    return empty;
  }

  const openai = new OpenAI({ apiKey });

  const userPayload = inputs.map((i) => ({
    id: i.id,
    order_id: i.order_id,
    platform: i.platform,
    issue_type: i.issue_type,
    amount: i.amount,
  }));

  const system = `You are RefundRadar's advisory refund decision engine.
You NEVER execute refunds, charge cards, or contact Amazon/Uber. You only analyze and suggest.
Return ONLY valid JSON (no markdown) with this exact shape:
{"decisions":[{"order_id":"string","refund_score":number,"confidence":number,"priority":"HIGH VALUE"|"FAST"|"MEDIUM","estimated_refund":number,"reason":"string","claim_message":"string"}]}
Rules:
- refund_score: integer 0-100
- confidence: integer 0-100 (how confident you are in this advisory; may equal refund_score if unsure)
- priority must be exactly one of: HIGH VALUE, FAST, MEDIUM
- estimated_refund: number in USD (major units), conservative estimate
- claim_message: short professional message the user could paste as a starting point (advisory only)
Style for claim_message:
- U.S. consumer-dispute tone: calm, firm, rights-aware.
- No statute numbers/case citations, no invented facts, no threats.
- If appropriate, include: notice of dispute, requested resolution, and a reasonable deadline.`;

  const user = `Analyze these orders and fill one decision per order_id.
Orders JSON:
${JSON.stringify(userPayload)}`;

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? '';
    if (!text) {
      console.error('[refundDecisionEngine] Empty OpenAI response');
      return empty;
    }

    const parsed = parseDecisionJson(text, inputs);
    return await enrichWithComplaintGenerator(inputs, parsed);
  } catch (e) {
    console.error('[refundDecisionEngine] OpenAI error', e);
    return empty;
  }
}

export function decisionsMapToArray(
  inputs: RefundDecisionInput[],
  map: Map<string, RefundDecisionOutput>
): RefundDecisionWithKey[] {
  const out: RefundDecisionWithKey[] = [];
  for (const i of inputs) {
    const d = map.get(i.id);
    if (!d) continue;
    out.push({ ...d, id: i.id, order_id: i.order_id });
  }
  return out;
}
