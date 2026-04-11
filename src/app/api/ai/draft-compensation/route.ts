import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PlatformKey = 'amazon' | 'uber_eats' | 'uber_rides' | 'doordash';
type ManualIssueKey =
  | 'missing_item'
  | 'cold_food'
  | 'charged_incorrectly'
  | 'damaged_item'
  | 'trip_issue'
  | 'driver_route_issue';

type Body = {
  platform?: unknown;
  manualIssues?: unknown;
};

function asPlatform(v: unknown): PlatformKey | null {
  switch (v) {
    case 'amazon':
    case 'uber_eats':
    case 'uber_rides':
    case 'doordash':
      return v;
    default:
      return null;
  }
}

function normalizeManualIssues(v: unknown): ManualIssueKey[] {
  if (!Array.isArray(v)) return [];
  const allowed = new Set<ManualIssueKey>([
    'missing_item',
    'cold_food',
    'charged_incorrectly',
    'damaged_item',
    'trip_issue',
    'driver_route_issue',
  ]);
  const out: ManualIssueKey[] = [];
  for (const x of v) {
    if (typeof x !== 'string') continue;
    const k = x as ManualIssueKey;
    if (allowed.has(k) && !out.includes(k)) out.push(k);
  }
  return out.slice(0, 4);
}

function platformLabel(p: PlatformKey): string {
  if (p === 'uber_eats') return 'Uber Eats';
  if (p === 'uber_rides') return 'Uber Rides';
  if (p === 'doordash') return 'DoorDash';
  return 'Amazon';
}

function platformPlaybook(p: PlatformKey): string {
  switch (p) {
    case 'amazon':
      return `Amazon: write as a Prime/customer with a defective or incorrect order. Reference expectations under Amazon's customer-facing policies (e.g. A-to-z where relevant to the situation). Demand a concrete remedy: replacement, partial refund, or account credit proportional to the failure. Name the problem (missing item, wrong charge, damage) with neutral facts.`;
    case 'uber_eats':
      return `Uber Eats: stress food safety/quality and order accuracy; fees paid for a service that was not delivered as ordered. Ask for a full review and a remedy consistent with Uber Eats support practice (credit or partial refund). Stay factual about what was wrong with the meal or order.`;
    case 'uber_rides':
      return `Uber Rides: focus on fare accuracy, route or service failure, and rider safety/comfort expectations under Uber's standards. Request adjustment or credit for incorrect charges or service defects. No threats; firm and specific about trip facts.`;
    case 'doordash':
      return `DoorDash: reference order completeness, food condition, and charges. Ask DoorDash support to apply their policy for incorrect, missing, or poor-quality items. Request credit or partial refund with clear facts.`;
  }
}

function issueLabel(i: ManualIssueKey): string {
  switch (i) {
    case 'missing_item':
      return 'Missing item';
    case 'cold_food':
      return 'Cold food';
    case 'charged_incorrectly':
      return 'Charged incorrectly';
    case 'damaged_item':
      return 'Damaged item';
    case 'trip_issue':
      return 'Trip issue';
    case 'driver_route_issue':
      return 'Driver route issue';
    default:
      return i;
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'AI drafting not configured (OPENAI_API_KEY missing)' },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const platform = asPlatform(body.platform);
  if (!platform) {
    return NextResponse.json({ ok: false, error: 'platform is required' }, { status: 400 });
  }

  const manualIssues = normalizeManualIssues(body.manualIssues);
  if (manualIssues.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Select at least one manual issue to draft a message' },
      { status: 400 }
    );
  }

  const issuesText = manualIssues.map(issueLabel).join(', ');
  const pLabel = platformLabel(platform);
  const playbook = platformPlaybook(platform);

  const system = `You are an expert consumer advocate drafting outbound messages to large US platforms (Amazon, Uber, Uber Eats, DoorDash).
Your job is to produce the strongest *professional* request possible: clear facts, firm tone, explicit ask for remedy, escalation-friendly wording — without crossing into harassment, false legal threats, or guaranteed outcomes.
Never claim court action, lawyers, or guaranteed refunds. Never mention AI, bots, or "automated" systems.
Never invent order numbers or amounts; use placeholders like [Order date] or [Order ID] only if needed.
Output ONLY the final message body (no markdown, no quotes, no subject line).`;

  const user = `Write a powerful, persuasive support message for ${pLabel}.
Platform guidance:
${playbook}

Hard rules:
- Do NOT focus on late delivery or trip delay (handled elsewhere). Issues to address: ${issuesText}.
- 8–14 sentences: open with purpose, state facts, then bullet list (2–5 bullets) of issues, then explicit ask for review and remedy (credit, partial refund, replacement, or account adjustment per policy).
- Tone: confident, respectful, impossible to dismiss as vague — but never abusive.
- Ask for written confirmation of the resolution if appropriate.
- Close with "[Your Name]" as placeholder.`;

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.15,
      max_tokens: 520,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim() || '';
    if (!text) {
      return NextResponse.json({ ok: false, error: 'Empty AI response' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, draft: text });
  } catch (e) {
    console.error('[api/ai/draft-compensation]', e);
    return NextResponse.json({ ok: false, error: 'AI request failed' }, { status: 502 });
  }
}

