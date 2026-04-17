'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { RefyndraMark } from '@/components/brand/RefyndraMark';

export function SignupForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const emailTrim = email.trim();
    if (!emailTrim || !password) {
      setError('Please enter email and password.');
      return;
    }
    try {
      setLoading(true);
      const supabase = createClient();
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: emailTrim,
        password,
        options: {
          emailRedirectTo: origin ? `${origin}/dashboard` : undefined,
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
      if (signUpData.session) {
        window.location.href = '/dashboard';
        return;
      }
      setError(
        'Account created — check your email to confirm, then sign in. If confirmation is off in Supabase, use Sign in with the same email and password.'
      );
      setLoading(false);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="text-center">
        <Link
          href="/"
          translate="no"
          className="inline-flex items-center justify-center gap-3 text-3xl font-bold text-white hover:text-[var(--accent)] sm:text-2xl"
        >
          <RefyndraMark size={48} variant="inline" className="shrink-0" aria-hidden />
          <span>Refyndra AI</span>
        </Link>
        <h1 className="mt-6 text-3xl font-bold text-white sm:text-2xl">Create account</h1>
        <p className="mt-2 text-base text-[var(--muted)] sm:text-sm">Professional refund intelligence for your purchases.</p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8">
        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-base text-red-300 sm:text-sm sm:text-red-400">
            {error}
          </div>
        )}
        <form onSubmit={handleSignUp} className="space-y-4">
          <p className="rounded-lg border border-violet-500/30 bg-gradient-to-br from-violet-950/80 to-zinc-950/90 px-4 py-3 text-sm font-semibold leading-snug text-violet-100 shadow-inner shadow-violet-500/10">
            <span className="font-bold text-white">Choose a password for your Refyndra account.</span> Not your Gmail
            password. Gmail sync is set up separately in your dashboard after sign-up.
          </p>
          <div>
            <label htmlFor="signup-email" className="mb-1 block text-base font-semibold text-zinc-200 sm:text-xs sm:font-medium sm:text-[var(--muted)]">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full min-h-[52px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3.5 text-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] sm:min-h-0 sm:py-3 sm:text-sm sm:placeholder:text-[var(--muted)]"
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="signup-password" className="mb-1 block text-base font-semibold text-zinc-200 sm:text-xs sm:font-medium sm:text-[var(--muted)]">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-[52px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3.5 text-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] sm:min-h-0 sm:py-3 sm:text-sm sm:placeholder:text-[var(--muted)]"
              placeholder="Create a strong password"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex min-h-[52px] w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--accent)] px-4 py-3.5 text-base font-bold text-[var(--background)] transition-colors hover:bg-[var(--accent-muted)] disabled:opacity-60 sm:min-h-0 sm:py-3 sm:text-sm sm:font-medium"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
      </div>

      <p className="text-center text-base text-[var(--muted)] sm:text-sm">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-[var(--accent)] hover:underline">
          Sign in
        </Link>
      </p>
      <p className="text-center text-base text-[var(--muted)] sm:text-sm">
        <Link href="/" className="hover:text-[var(--accent)]">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
