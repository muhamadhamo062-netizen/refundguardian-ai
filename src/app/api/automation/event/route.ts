import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/requireUser';

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
    const auth = await requireUser();
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
    }
    const { supabase, user } = auth;

    const { data: profile } = await supabase
      .from('users')
      .select('autonomous_mode_enabled')
      .eq('id', user.id)
      .single();

    if (!profile?.autonomous_mode_enabled) {
      return NextResponse.json(
        { ok: false, error: 'Autonomous mode required' },
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
