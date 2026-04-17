import { NextResponse } from 'next/server';

import { createServiceRoleClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export type PublicLandingStats = {
  totalRecoveredCents: number;
  successfulCompensations: number;
  totalUsers: number;
};

/**
 * Public aggregate stats for the marketing site (no auth). Uses service role + `get_public_landing_stats` RPC.
 */
export async function GET() {
  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Stats unavailable',
        totalRecoveredCents: 0,
        successfulCompensations: 0,
        totalUsers: 0,
      } satisfies PublicLandingStats & { ok: boolean; error?: string },
      { status: 503, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
    );
  }

  const { data, error } = await admin.rpc('get_public_landing_stats');

  if (error) {
    console.error('[api/stats/public]', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        totalRecoveredCents: 0,
        successfulCompensations: 0,
        totalUsers: 0,
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const row =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : (Array.isArray(data) && data[0] && typeof data[0] === 'object' ? (data[0] as Record<string, unknown>) : null);

  const num = (v: unknown) => {
    if (v === undefined || v === null) return 0;
    const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
  };

  const payload: PublicLandingStats & { ok: true } = {
    ok: true,
    totalRecoveredCents: num(row?.total_recovered_cents),
    successfulCompensations: num(row?.successful_compensations),
    totalUsers: num(row?.total_users),
  };

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}
