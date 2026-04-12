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
        <h1 className="text-2xl font-bold text-white sm:text-xl">Permission required</h1>
        <p className="mt-4 text-base text-[var(--muted)] sm:text-sm">
          To use the automated compensation assistant, you must accept the following:
        </p>
        <blockquote className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-base text-[var(--foreground)] italic sm:text-sm">
          {CONSENT_TEXT}
        </blockquote>
        {error && (
          <p className="mt-4 text-base text-red-300 sm:text-sm sm:text-red-400">{error}</p>
        )}
        <div className="mt-8 flex gap-4">
          <button
            type="button"
            onClick={handleAccept}
            disabled={loading}
            className="flex-1 min-h-[52px] rounded-lg bg-[var(--accent)] py-3.5 text-base font-bold text-[var(--background)] hover:bg-[var(--accent-muted)] disabled:opacity-60 sm:min-h-0 sm:py-3 sm:text-sm sm:font-medium"
          >
            {loading ? 'Saving…' : 'I accept'}
          </button>
          <Link
            href="/dashboard"
            className="flex-1 min-h-[52px] rounded-lg border border-[var(--border)] py-3.5 text-center text-base font-semibold text-[var(--muted)] hover:bg-[var(--card-hover)] sm:min-h-0 sm:py-3 sm:text-sm sm:font-medium"
          >
            Skip for now
          </Link>
        </div>
        <p className="mt-4 text-base text-[var(--muted)] sm:text-xs">
          <Link href="/" className="hover:text-[var(--accent)]">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
