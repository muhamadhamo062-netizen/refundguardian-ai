import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/api';
import { isProSubscriber } from '@/lib/billing/plan';

export const dynamic = 'force-dynamic';

type Body = {
  order_id?: string;
  platform?: string;
  issue_type?: string;
  action?: string;
  detail?: Record<string, unknown>;
};

/** Append a transparent automation audit row (user-visible; RLS). */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Missing Authorization token' }, { status: 401 });
    }

    const supabase = createSupabaseClient(token);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('plan, subscription_status, trial_ends_at, autonomous_mode_enabled')
      .eq('id', user.id)
      .single();

    if (!isProSubscriber(profile) || !profile?.autonomous_mode_enabled) {
      return NextResponse.json(
        { ok: false, error: 'Autonomous mode and Pro required' },
        { status: 403 }
      );
    }

    let body: Body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const action = typeof body.action === 'string' ? body.action : 'event';
    const { error: insErr } = await supabase.from('automation_events').insert({
      user_id: user.id,
      order_id: body.order_id ?? null,
      platform: body.platform ?? null,
      issue_type: body.issue_type ?? null,
      action,
      detail: body.detail ?? {},
    });

    if (insErr) {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/automation/event POST]', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
