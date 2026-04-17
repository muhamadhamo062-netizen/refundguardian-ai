import OpenAI from 'openai';

import { getOpenAiChatModel } from '@/lib/ai/openaiModel';

export type ComplaintTone = 'Professional' | 'Aggressive' | 'Disappointed';

export type ComplaintPlatform =
  | 'amazon'
  | 'talabat'
  | 'instashop'
  | 'deliveroo'
  | 'uber_eats'
  | 'uber_rides'
  | 'doordash';

type ComplaintInput = {
  platform: ComplaintPlatform;
  issues: string[];
  model?: string;
  context?: string;
  /** Real sign-off name when available (e.g. from profile). */
  customerDisplayName?: string;
  /** Recent order lines for personalization (dates, order #, merchant). */
  orderContext?: string;
};

const TONES: ComplaintTone[] = ['Professional', 'Aggressive', 'Disappointed'];

function platformLabel(p: ComplaintPlatform): string {
  switch (p) {
    case 'uber_eats':
      return 'Uber Eats';
    case 'uber_rides':
      return 'Uber Rides';
    case 'doordash':
      return 'DoorDash';
    case 'talabat':
      return 'Talabat';
    case 'instashop':
      return 'InstaShop';
    case 'deliveroo':
      return 'Deliveroo';
    default:
      return 'Amazon';
  }
}

function playbook(p: ComplaintPlatform): string {
  switch (p) {
    case 'amazon':
      return 'Amazon: emphasize reliability expectations, order promise, and a concrete remedy request.';
    case 'talabat':
      return 'Talabat: emphasize delivery SLA miss, order quality/accuracy, and immediate account remedy.';
    case 'instashop':
      return 'InstaShop: emphasize grocery freshness/timing impact and failed service standards.';
    case 'deliveroo':
      return 'Deliveroo: emphasize order lateness and paid-fee service failure with evidence-first language.';
    case 'uber_eats':
      return 'Uber Eats: emphasize paid service failure, food quality/timing, and precise compensation request.';
    case 'uber_rides':
      return 'Uber Rides: emphasize route/fare/timing mismatch and rider impact with concise facts.';
    case 'doordash':
      return 'DoorDash: emphasize delivery timing and order integrity with explicit policy-based ask.';
  }
}

function pickTone(): ComplaintTone {
  const idx = Math.floor(Math.random() * TONES.length);
  return TONES[idx] ?? 'Professional';
}

export async function generateHumanLikeComplaint(input: ComplaintInput): Promise<{
  draft: string;
  tone: ComplaintTone;
  model: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY missing');
  }

  const model = input.model?.trim() || getOpenAiChatModel();
  const tone = pickTone();
  const issues = input.issues.filter(Boolean).slice(0, 6);
  if (issues.length === 0) {
    throw new Error('At least one issue is required');
  }

  const system = `You are a senior U.S. consumer-rights communications specialist drafting merchant-facing correspondence on behalf of a real customer.
Write in polished, human, executive-level English — calm authority, not spam, not robotic.
Rules:
- Sound like a careful person who understands policies and expects a fair remedy; never threaten litigation or regulators.
- No profanity, no fabricated facts, no invented order numbers, dates, or amounts beyond the provided hints.
- Never mention AI, automation, templates, or that a third party wrote this.
- Vary sentence rhythm and openings; avoid boilerplate repetition.
Output only the final message body (no subject line, no markdown fences).`;

  const signOff =
    input.customerDisplayName?.trim() ||
    'the customer (use a neutral closing if name unknown)';
  const orderBlock =
    input.orderContext?.trim() ||
    'Use general language about a recent order — do not invent order numbers or dates.';

  const user = `Platform: ${platformLabel(input.platform)}
Tone style: ${tone}
Platform guidance: ${playbook(input.platform)}
Issue list: ${issues.join(', ')}
Context: ${input.context ?? 'Delay-related customer complaint from dashboard scan.'}

Customer / order intelligence (use factually — do not invent specifics beyond this):
- Sign-off name to use: ${signOff}
- Recent order hints from the user's account: ${orderBlock}

Write 9-14 sentences with this structure:
1) strong opening sentence stating service failure impact
2) concise factual block (reference order hints only where they match the issues)
3) bullet list (2-5 bullets) of concrete failures
4) explicit ask for compensation/remedy and written confirmation
5) close with a professional sign-off using the customer's name exactly as given above when it is a real name (not placeholder text)

Keep it human-sounding and varied; not robotic.`;

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.65,
    max_tokens: 900,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const draft = completion.choices[0]?.message?.content?.trim() ?? '';
  if (!draft) throw new Error('Empty complaint response');

  return { draft, tone, model };
}
