import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/api';
import { isExtensionSyncTableMissingError } from '@/lib/supabase/dbErrors';

const ALLOWED_TYPES = new Set(['amazon_orders_batch']);

/**
 * Persists a row after extension-notified batches (e.g. successful Amazon ingest).
 * Authenticated via Bearer token; insert is best-effort if migration not applied.
 */
export async function POST(request: Request) {
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
    return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 401 });
  }

  let body: { type?: string; data?: unknown; meta?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const eventType = typeof body.type === 'string' ? body.type : '';
  if (!ALLOWED_TYPES.has(eventType)) {
    return NextResponse.json({ ok: false, error: 'Unsupported type' }, { status: 400 });
  }

  const orderCount = Array.isArray(body.data) ? body.data.length : 0;
  const meta =
    body.meta && typeof body.meta === 'object' && body.meta !== null
      ? (body.meta as Record<string, unknown>)
      : {};

  const { data: row, error: insErr } = await supabase
    .from('extension_sync_events')
    .insert({
      user_id: user.id,
      event_type: eventType,
      order_count: orderCount,
      meta,
    })
    .select('id')
    .single();

  if (insErr) {
    if (isExtensionSyncTableMissingError(insErr)) {
      console.warn(
        '[Refyndra] Migration 014 missing – extension_sync_events not persisting.'
      );
      return NextResponse.json({
        ok: true,
        acknowledged: true,
        persisted: false,
        hint: 'Run migration 014_extension_sync_events.sql',
      });
    }
    return NextResponse.json(
      { ok: false, error: insErr.message, acknowledged: true },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    acknowledged: true,
    persisted: true,
    id: row?.id ?? null,
    order_count: orderCount,
  });
}
