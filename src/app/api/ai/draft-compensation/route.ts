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

  const system = `You write short, professional customer support messages for US consumers.
You never claim guaranteed refunds. You never mention AI or internal systems.
Output ONLY the final message text (no markdown, no quotes).`;

  const user = `Write a concise message for ${pLabel} support.
Context:
- The platform automatically handles delay detection separately; do NOT mention late delivery/trip delay.
- The user selected these issues: ${issuesText}.
Requirements:
- 5–9 sentences total.
- Polite, confident, and specific.
- Ask for an appropriate adjustment/refund/credit based on policy.
- Include a short bullet list of the issues (2–4 bullets).
- End with a simple closing and the user's name placeholder: "[Your Name]".`;

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 280,
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

