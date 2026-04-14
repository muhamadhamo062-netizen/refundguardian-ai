import OpenAI from 'openai';

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

  const model = input.model?.trim() || 'gpt-4o-mini';
  const tone = pickTone();
  const issues = input.issues.filter(Boolean).slice(0, 6);
  if (issues.length === 0) {
    throw new Error('At least one issue is required');
  }

  const system = `You draft high-pressure but policy-safe customer complaints to large delivery/commerce platforms.
Anti-template rules:
- Vary sentence length and openings naturally each request.
- Avoid repeated phrasing patterns.
- Never mention AI, automation, templates, or "generated text".
- No profanity, no legal threats, no fabricated facts.
Output only the final complaint body.`;

  const user = `Platform: ${platformLabel(input.platform)}
Tone style: ${tone}
Platform guidance: ${playbook(input.platform)}
Issue list: ${issues.join(', ')}
Context: ${input.context ?? 'Delay-related customer complaint from dashboard scan.'}

Write 9-14 sentences with this structure:
1) strong opening sentence stating service failure impact
2) concise factual block
3) bullet list (2-5 bullets) of concrete failures
4) explicit ask for compensation/remedy and written confirmation
5) close with [Your Name]

Keep it human-sounding and varied; not robotic.`;

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.7,
    max_tokens: 650,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const draft = completion.choices[0]?.message?.content?.trim() ?? '';
  if (!draft) throw new Error('Empty complaint response');

  return { draft, tone, model };
}
