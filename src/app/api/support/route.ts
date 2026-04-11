import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Body = {
  name?: unknown;
  email?: unknown;
  whatsapp?: unknown;
  message?: unknown;
  company?: unknown; // honeypot
};

function asText(v: unknown, maxLen: number): string {
  const s = typeof v === 'string' ? v : '';
  return s.trim().slice(0, maxLen);
}

function isValidEmail(email: string): boolean {
  if (email.length < 5 || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  // Simple honeypot spam protection
  const company = asText(body.company, 80);
  if (company) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const name = asText(body.name, 80);
  const email = asText(body.email, 254);
  const whatsapp = asText(body.whatsapp, 40);
  const message = asText(body.message, 4000);

  if (!name) return NextResponse.json({ ok: false, error: 'Name is required' }, { status: 400 });
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: 'Valid email is required' }, { status: 400 });
  }
  if (!message || message.length < 10) {
    return NextResponse.json(
      { ok: false, error: 'Message is required (min 10 characters)' },
      { status: 400 }
    );
  }

  const accessKey = process.env.THREEFORMS_ACCESS_KEY?.trim();
  if (!accessKey) {
    console.error('[api/support] Missing THREEFORMS_ACCESS_KEY');
    return NextResponse.json({ ok: false, error: 'Support email is not configured' }, { status: 503 });
  }

  const subject = `[Refyndra] Support request from ${name}`;

  try {
    const res = await fetch('https://api.3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_key: accessKey,
        subject,
        name,
        email,
        whatsapp: whatsapp || undefined,
        message,
      }),
    });

    const json = (await res.json().catch(() => null)) as
      | { success?: boolean; message?: string }
      | null;

    if (!res.ok || json?.success !== true) {
      console.error('[api/support] 3Forms failed', res.status, json);
      return NextResponse.json({ ok: false, error: 'Could not send message' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/support] 3Forms request failed', e);
    return NextResponse.json({ ok: false, error: 'Could not send message' }, { status: 502 });
  }
}

