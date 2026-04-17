import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/api';
import {
  generateHumanLikeComplaint,
  type ComplaintPlatform,
} from '@/lib/ai/complaintGenerator';
import { getOpenAiChatModel } from '@/lib/ai/openaiModel';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PlatformKey =
  | 'amazon'
  | 'talabat'
  | 'instashop'
  | 'deliveroo'
  | 'uber_eats'
  | 'uber_rides'
  | 'doordash';
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
    case 'talabat':
    case 'instashop':
    case 'deliveroo':
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
  if (p === 'talabat') return 'Talabat';
  if (p === 'instashop') return 'InstaShop';
  if (p === 'deliveroo') return 'Deliveroo';
  if (p === 'uber_eats') return 'Uber Eats';
  if (p === 'uber_rides') return 'Uber Rides';
  if (p === 'doordash') return 'DoorDash';
  return 'Amazon';
}

function platformPlaybook(p: PlatformKey): string {
  switch (p) {
    case 'amazon':
      return `Amazon: write as a Prime/customer with a defective or incorrect order. Reference expectations under Amazon's customer-facing policies (e.g. A-to-z where relevant to the situation). Demand a concrete remedy: replacement, partial refund, or account credit proportional to the failure. Name the problem (missing item, wrong charge, damage) with neutral facts.`;
    case 'talabat':
      return `Talabat: stress delayed or degraded service quality and paid-fee expectations. Ask for a concrete remedy and written confirmation.`;
    case 'instashop':
      return `InstaShop: stress delay and grocery freshness/service expectations. Ask for a policy-aligned credit or refund with clear facts.`;
    case 'deliveroo':
      return `Deliveroo: stress timing/service failure and paid-fee expectations. Request direct remediation and support confirmation.`;
    case 'uber_eats':
      return `Uber Eats: stress food safety/quality and order accuracy; fees paid for a service that was not delivered as ordered. Ask for a full review and a remedy consistent with Uber Eats support practice (credit or partial refund). Stay factual about what was wrong with the meal or order.`;
    case 'uber_rides':
      return `Uber Rides: focus on fare accuracy, route or service failure, and rider safety/comfort expectations under Uber's standards. Request adjustment or credit for incorrect charges or service defects. No threats; firm and specific about trip facts.`;
    case 'doordash':
      return `DoorDash: reference order completeness, food condition, and charges. Ask DoorDash support to apply their policy for incorrect, missing, or poor-quality items. Request credit or partial refund with clear facts.`;
  }
}

function orderProviderForPlatform(p: PlatformKey): string {
  if (p === 'uber_rides') return 'uber';
  if (p === 'uber_eats') return 'uber_eats';
  if (p === 'doordash') return 'doordash';
  if (p === 'amazon') return 'amazon';
  return 'other';
}

async function loadCustomerDraftContext(
  req: Request,
  platform: PlatformKey
): Promise<{ displayName: string; orderContext: string }> {
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    return { displayName: '', orderContext: '' };
  }

  const supabase = createSupabaseClient(token);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { displayName: '', orderContext: '' };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, email')
    .eq('id', user.id)
    .maybeSingle();

  const displayName =
    (profile && typeof profile.full_name === 'string' && profile.full_name.trim()) ||
    (typeof user.email === 'string' ? user.email.split('@')[0] : '') ||
    '';

  const provider = orderProviderForPlatform(platform);
  const { data: orders, error: ordErr } = await supabase
    .from('orders')
    .select('order_id, order_date, merchant_name, order_value_cents, provider')
    .eq('user_id', user.id)
    .eq('provider', provider)
    .order('order_date', { ascending: false })
    .limit(3);

  if (ordErr) {
    return {
      displayName,
      orderContext: '',
    };
  }

  const lines = (orders ?? [])
    .map((o: { order_id?: string | null; order_date?: string | null; merchant_name?: string | null; order_value_cents?: number | null }) => {
      const amt =
        typeof o.order_value_cents === 'number' ? `$${(o.order_value_cents / 100).toFixed(2)}` : '—';
      const d = o.order_date ? new Date(o.order_date).toLocaleDateString('en-US') : '—';
      return `Order ${o.order_id ?? '—'} · ${d} · ${o.merchant_name ?? '—'} · ${amt}`;
    })
    .join(' | ');

  return {
    displayName,
    orderContext: lines,
  };
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
  const model = getOpenAiChatModel();
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

  try {
    const { displayName, orderContext } = await loadCustomerDraftContext(req, platform);
    const response = await generateHumanLikeComplaint({
      platform: platform as ComplaintPlatform,
      issues: manualIssues.map(issueLabel),
      model,
      customerDisplayName: displayName || undefined,
      orderContext: orderContext || undefined,
      context: `Generate an executive-level, merchant-facing dispute for ${platformLabel(platform)} (U.S. market). ${platformPlaybook(
        platform
      )}`,
    });
    if (!response.draft) {
      return NextResponse.json({ ok: false, error: 'Empty AI response' }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      draft: response.draft,
      complaint_tone: response.tone,
      model: response.model,
      complaint_status: 'generated',
    });
  } catch (e) {
    console.error('[api/ai/draft-compensation]', e);
    return NextResponse.json({ ok: false, error: 'AI request failed' }, { status: 502 });
  }
}

