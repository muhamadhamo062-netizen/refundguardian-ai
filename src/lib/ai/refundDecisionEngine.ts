import OpenAI from 'openai';

import { getOpenAiChatModel } from '@/lib/ai/openaiModel';
import type {
  RefundDecisionInput,
  RefundDecisionOutput,
  RefundDecisionWithKey,
} from '@/lib/ai/refundDecision.types';

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

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = getOpenAiChatModel();

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

  const system = `You are Refyndra's advisory refund decision engine for U.S. consumers.
You NEVER execute refunds, charge cards, or contact merchants. You only analyze and suggest.
Write reasons and claim_message in polished, natural American English — executive tone, concise, no hype.
Return ONLY valid JSON (no markdown) with this exact shape:
{"decisions":[{"order_id":"string","refund_score":number,"confidence":number,"priority":"HIGH VALUE"|"FAST"|"MEDIUM","estimated_refund":number,"reason":"string","claim_message":"string"}]}
Rules:
- refund_score: integer 0-100
- confidence: integer 0-100 (how confident you are in this advisory; may equal refund_score if unsure)
- priority must be exactly one of: HIGH VALUE, FAST, MEDIUM
- estimated_refund: number in USD (major units), conservative estimate
- claim_message: 2-4 sentences the customer could paste as a starting point (advisory only; no threats, no invented facts)`;

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

    return parseDecisionJson(text, inputs);
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

function heuristicDecisionForMissingAi(i: RefundDecisionInput): RefundDecisionOutput {
  const base = typeof i.amount === 'number' && Number.isFinite(i.amount) ? i.amount : 10;
  const estimated = Math.min(48, Math.round(base * 0.14 * 100) / 100);
  return {
    refund_score: 56,
    priority: 'MEDIUM',
    estimated_refund: estimated,
    reason:
      'Preliminary signal on this order. Full AI scoring will appear once the Refyndra AI engine is available (check OpenAI billing and API key).',
    claim_message:
      'I am writing to request a good-faith review of my recent order and a fair resolution consistent with your policies.',
    confidence: 42,
  };
}

/** Ensures every submitted order has a row so the first free scan can complete even if the model returns partial JSON. */
export function decisionsMapToArrayWithFallback(
  inputs: RefundDecisionInput[],
  map: Map<string, RefundDecisionOutput>
): RefundDecisionWithKey[] {
  const out: RefundDecisionWithKey[] = [];
  for (const i of inputs) {
    const d = map.get(i.id);
    if (d) {
      out.push({ ...d, id: i.id, order_id: i.order_id });
    } else {
      out.push({ ...heuristicDecisionForMissingAi(i), id: i.id, order_id: i.order_id });
    }
  }
  return out;
}
