import { createClient } from '@/lib/supabase/server';

export type RequireUserResult =
  | { ok: true; supabase: ReturnType<typeof createClient>; user: { id: string } }
  | { ok: false; error: string };

export async function requireUser(): Promise<RequireUserResult> {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    return { ok: false, error: 'Unauthorized' };
  }

  return { ok: true, supabase, user: { id: user.id } };
}

