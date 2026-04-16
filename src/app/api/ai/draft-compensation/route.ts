import { NextResponse } from 'next/server';
import { generateStructuredComplaint } from '@/lib/ai/complaintGenerator';
import type { RefundPlatform } from '@/lib/refundPriorityEngine';

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
  if (!process.env.OPENAI_API_KEY?.trim()) {
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

  const issues = manualIssues.map(issueLabel);
  const pLabel = platformLabel(platform);

  try {
    const text = await generateStructuredComplaint({
      platform: platform as RefundPlatform,
      issues,
      toneSeed: `${platform}:${manualIssues.join(',')}`,
      context: `Manual issues only (do not argue late delivery / trip delay — handled separately): ${issues.join(
        '; '
      )}. Platform label: ${pLabel}.`,
    });
    return NextResponse.json({ ok: true, draft: text });
  } catch (e) {
    console.error('[api/ai/draft-compensation]', e);
    return NextResponse.json({ ok: false, error: 'AI request failed' }, { status: 502 });
  }
}

