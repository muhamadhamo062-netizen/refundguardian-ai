import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Public: whether server-side AI drafting is configured (OPENAI_API_KEY).
 * Does not expose keys or model names.
 */
export async function GET() {
  const aiDraftingEnabled = Boolean(process.env.OPENAI_API_KEY?.trim());
  return NextResponse.json({ ok: true, aiDraftingEnabled });
}
