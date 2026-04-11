import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/api';

/**
 * Forward structured compensation events to your OpenAI / automation webhook (n8n, Make, etc.).
 * Each request can use a different prompt server-side so outbound copy stays varied.
 *
 * Set COMPENSATION_LETTER_WEBHOOK_URL (server-only) to your endpoint.
 * Not legal advice; does not guarantee payment from any merchant.
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Missing Authorization' }, { status: 401 });
    }

    const supabase = createSupabaseClient(token);
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: 'Invalid session' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const webhook = process.env.COMPENSATION_LETTER_WEBHOOK_URL;
    if (!webhook || !webhook.startsWith('https://')) {
      return NextResponse.json(
        {
          ok: false,
          error: 'COMPENSATION_LETTER_WEBHOOK_URL not configured',
          hint: 'Set a server-side https URL to your OpenAI proxy or automation tool.',
        },
        { status: 501 }
      );
    }

    const secret = process.env.COMPENSATION_LETTER_WEBHOOK_SECRET;
    const payload = {
      event: 'compensation_letter_request',
      user_id: user.id,
      at: new Date().toISOString(),
      ...body,
    };

    const res = await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'X-Refyndra-Secret': secret } : {}),
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: 'Webhook returned error', status: res.status, upstream: parsed },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, upstream: parsed });
  } catch (e) {
    console.error('[api/compensation-letter]', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
