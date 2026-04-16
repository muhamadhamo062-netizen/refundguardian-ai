import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/requireUser';

export const dynamic = 'force-dynamic';

/** Toggle autonomous automation flag (user-controlled). */
export async function PATCH(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
    }
    const { supabase, user } = auth;

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
