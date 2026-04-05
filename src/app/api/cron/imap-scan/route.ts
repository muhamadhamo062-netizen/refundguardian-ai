/**
 * Scheduled IMAP ingest (cron / external scheduler).
 *
 * Security: requires `CRON_SECRET` in env and matching `x-cron-secret` or `Authorization: Bearer`.
 *
 * Deploy:
 * - Vercel: add `vercel.json` crons pointing here, set CRON_SECRET + SUPABASE_SERVICE_ROLE_KEY + GMAIL_IMAP_ENCRYPTION_KEY.
 * - Else: `curl -H "x-cron-secret: $CRON_SECRET" https://your-domain/api/cron/imap-scan`
 */

import { NextResponse } from 'next/server';

import { createServiceRoleClient } from '@/lib/supabase/admin';
import { ingestImapForAllUsers } from '@/lib/server/imapCronIngest';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** Raise on Vercel Pro if many users + IMAP latency. */
export const maxDuration = 300;

function authorize(request: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;
  const h = request.headers.get('x-cron-secret')?.trim();
  if (h && h === expected) return true;
  const auth = request.headers.get('authorization');
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return !!bearer && bearer === expected;
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.GMAIL_IMAP_ENCRYPTION_KEY?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'GMAIL_IMAP_ENCRYPTION_KEY not configured' },
      { status: 503 }
    );
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY not configured' },
      { status: 503 }
    );
  }

  try {
    const results = await ingestImapForAllUsers(admin);
    const summary = {
      users: results.length,
      inserted: results.reduce((s, r) => s + r.inserted, 0),
      letters: results.reduce((s, r) => s + r.letters, 0),
      errors: results.filter((r) => r.error).length,
    };
    return NextResponse.json({ ok: true, summary, results });
  } catch (e) {
    console.error('[api/cron/imap-scan]', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'cron_failed' },
      { status: 500 }
    );
  }
}
