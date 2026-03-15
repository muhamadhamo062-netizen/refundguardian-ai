'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const CONSENT_TEXT =
  'I allow the system to monitor my delivery orders and request compensation on my behalf when delays happen.';

export default function ConsentPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) window.location.href = '/login';
    });
  }, []);

  const handleAccept = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Not logged in');
        setLoading(false);
        return;
      }
      const { error: updateError } = await supabase
        .from('users')
        .update({
          consent_given_at: new Date().toISOString(),
          consent_text: CONSENT_TEXT,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save consent');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--background)]">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8">
        <h1 className="text-xl font-bold text-white">Permission required</h1>
        <p className="mt-4 text-sm text-[var(--muted)]">
          To use the automated compensation assistant, you must accept the following:
        </p>
        <blockquote className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-sm text-[var(--foreground)] italic">
          {CONSENT_TEXT}
        </blockquote>
        {error && (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        )}
        <div className="mt-8 flex gap-4">
          <button
            type="button"
            onClick={handleAccept}
            disabled={loading}
            className="flex-1 rounded-lg bg-[var(--accent)] py-3 text-sm font-medium text-[var(--background)] hover:bg-[var(--accent-muted)] disabled:opacity-60"
          >
            {loading ? 'Saving…' : 'I accept'}
          </button>
          <Link
            href="/dashboard"
            className="flex-1 rounded-lg border border-[var(--border)] py-3 text-center text-sm font-medium text-[var(--muted)] hover:bg-[var(--card-hover)]"
          >
            Skip for now
          </Link>
        </div>
        <p className="mt-4 text-xs text-[var(--muted)]">
          <Link href="/" className="hover:text-[var(--accent)]">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
