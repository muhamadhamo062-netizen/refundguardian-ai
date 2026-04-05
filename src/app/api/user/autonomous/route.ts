import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/api';
import { isProSubscriber } from '@/lib/billing/plan';

export const dynamic = 'force-dynamic';

/** Toggle autonomous automation flag (Pro only; never executes merchant refunds server-side). */
export async function PATCH(request: Request) {
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
      .select('plan, subscription_status, trial_ends_at')
      .eq('id', user.id)
      .single();

    if (!isProSubscriber(profile)) {
      return NextResponse.json(
        { ok: false, error: 'Pro subscription required for Autonomous mode' },
        { status: 403 }
      );
    }

    let body: { autonomous_mode_enabled?: boolean };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const enabled = Boolean(body.autonomous_mode_enabled);
    const { error: upErr } = await supabase
      .from('users')
      .update({ autonomous_mode_enabled: enabled, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, autonomous_mode_enabled: enabled });
  } catch (e) {
    console.error('[api/user/autonomous PATCH]', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
