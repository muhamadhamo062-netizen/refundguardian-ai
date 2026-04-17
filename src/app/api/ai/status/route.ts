import { NextResponse } from 'next/server';

import { getOpenAiChatModel } from '@/lib/ai/openaiModel';
import { createSupabaseClient } from '@/lib/supabase/api';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * AI engine status. Without auth: only whether OpenAI is configured (safe for public callers).
 * With session or Bearer: adds private fields for the signed-in dashboard.
 */
export async function GET(request: Request) {
  const openaiLinked = Boolean(process.env.OPENAI_API_KEY?.trim());
  const modelLabel = getOpenAiChatModel();

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '')?.trim();
  const supabase = token ? createSupabaseClient(token) : createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: true, aiDraftingEnabled: openaiLinked },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      aiDraftingEnabled: openaiLinked,
      systemActive: openaiLinked,
      openaiLinked,
      modelLabel,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
