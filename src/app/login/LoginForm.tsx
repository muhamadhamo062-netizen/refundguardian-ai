'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { RefyndraMark } from '@/components/brand/RefyndraMark';

export function LoginForm() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (searchParams.get('error') === 'auth') {
      setError('Authentication failed. Please try again.');
    }
  }, [searchParams]);

  const handleSignIn = async (e: React.FormEvent) => {
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

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailTrim,
        password,
      });
      if (!signInError && signInData.session) {
        window.location.href = '/dashboard';
        return;
      }

      if (signInError) {
        const msg = signInError.message.toLowerCase();
        if (msg.includes('invalid') || msg.includes('credentials') || msg.includes('password')) {
          setError('Wrong email or password — or create an account on the sign-up page.');
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }
      setError('Could not start your session. If email confirmation is on in Supabase, turn it off for instant login.');
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
        <h1 className="mt-6 text-3xl font-bold text-white sm:text-2xl">Sign in</h1>
        <p className="mt-2 text-base text-[var(--muted)] sm:text-sm">Access your Refyndra dashboard.</p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8">
        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-base text-red-300 sm:text-sm sm:text-red-400">
            {error}
          </div>
        )}
        <form onSubmit={handleSignIn} className="space-y-4">
          <p className="rounded-lg border border-emerald-500/25 bg-gradient-to-br from-emerald-950/50 to-zinc-950/90 px-4 py-3 text-sm font-semibold leading-snug text-emerald-100/95 shadow-inner shadow-emerald-500/10">
            <span className="font-bold text-white">Use your Refyndra password</span> — the password you created for this
            app. <span className="font-bold text-white">Do not enter your Gmail password here.</span>
          </p>
          <div>
            <label htmlFor="email" className="mb-1 block text-base font-semibold text-zinc-200 sm:text-xs sm:font-medium sm:text-[var(--muted)]">
              Email
            </label>
            <input
              id="email"
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
            <label htmlFor="password" className="mb-1 block text-base font-semibold text-zinc-200 sm:text-xs sm:font-medium sm:text-[var(--muted)]">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-[52px] rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3.5 text-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] sm:min-h-0 sm:py-3 sm:text-sm sm:placeholder:text-[var(--muted)]"
              placeholder="Your Refyndra password"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex min-h-[52px] w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--accent)] px-4 py-3.5 text-base font-bold text-[var(--background)] transition-colors hover:bg-[var(--accent-muted)] disabled:opacity-60 sm:min-h-0 sm:py-3 sm:text-sm sm:font-medium"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>

      <p className="text-center text-base text-[var(--muted)] sm:text-sm">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium text-[var(--accent)] hover:underline">
          Sign up
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
