import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/api';

export const dynamic = 'force-dynamic';

/** Current user billing / automation flags (RLS-scoped). */
export async function GET(request: Request) {
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

    const { data: row, error } = await supabase
      .from('users')
      .select(
        'plan, subscription_status, trial_ends_at, autonomous_mode_enabled, paddle_customer_id, paddle_subscription_id, free_trial_initial_scan_completed_at, trial_used, last_trial_scan_potential_cents'
      )
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!row) {
      return NextResponse.json({
        ok: true,
        profile: {
          plan: 'free',
          subscription_status: 'none',
          trial_ends_at: null,
          autonomous_mode_enabled: false,
          paddle_customer_id: null,
          paddle_subscription_id: null,
          free_trial_initial_scan_completed_at: null,
          trial_used: false,
          last_trial_scan_potential_cents: null,
        },
      });
    }

    return NextResponse.json({ ok: true, profile: row });
  } catch (e) {
    console.error('[api/user/billing GET]', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
