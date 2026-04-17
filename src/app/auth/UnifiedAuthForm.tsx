'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { RefyndraMark } from '@/components/brand/RefyndraMark';

type Mode = 'signup' | 'login';

function getMode(value: string | null): Mode {
  return value === 'signup' ? 'signup' : 'login';
}

export function UnifiedAuthForm() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<Mode>(() => getMode(searchParams.get('mode')));

  useEffect(() => {
    setMode(getMode(searchParams.get('mode')));
  }, [searchParams]);

  const onSubmit = async (e: React.FormEvent) => {
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

      if (mode === 'signup') {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const { data, error: signUpError } = await supabase.auth.signUp({
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
        if (data.session) {
          window.location.href = '/dashboard';
          return;
        }
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: emailTrim,
          password,
        });
        if (!signInError && signInData.session) {
          window.location.href = '/dashboard';
          return;
        }
        setError('Account created. Confirm your email, then sign in with the same password.');
        setLoading(false);
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailTrim,
        password,
      });
      if (signInError) {
        const msg = signInError.message.toLowerCase();
        if (msg.includes('invalid') || msg.includes('credentials') || msg.includes('password')) {
          setError('Wrong email or password. Try again or create an account.');
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }
      if (data.session) {
        window.location.href = '/dashboard';
        return;
      }
      setError('Could not start your session. Please try again.');
      setLoading(false);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const isSignUp = mode === 'signup';

  return (
    <div className="w-full max-w-md space-y-7">
      <div className="text-center">
        <Link
          href="/"
          translate="no"
          className="inline-flex items-center justify-center gap-3 text-3xl font-bold text-white hover:text-[var(--accent)] sm:text-2xl"
        >
          <RefyndraMark size={48} variant="inline" className="shrink-0" aria-hidden />
          <span>Refyndra AI</span>
        </Link>
        <h1 className="mt-6 text-3xl font-bold text-white sm:text-2xl">{isSignUp ? 'Create account' : 'Sign in'}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {isSignUp ? 'Takes under a minute. No Gmail setup on this screen.' : 'Fast sign-in — same email & password you registered with.'}
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8">
        {error ? <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}

        <form onSubmit={onSubmit} className="space-y-4">
          {isSignUp ? (
            <p className="rounded-lg border border-violet-500/30 bg-gradient-to-br from-violet-950/80 to-zinc-950/90 px-4 py-3 text-sm font-medium leading-snug text-violet-100 shadow-inner shadow-violet-500/10">
              Create your account with <span className="font-semibold text-white">any password you choose</span> for
              Refyndra. Connecting Gmail to import orders happens later inside your dashboard — not here.
            </p>
          ) : (
            <p className="rounded-lg border border-emerald-500/25 bg-gradient-to-br from-emerald-950/50 to-zinc-950/90 px-4 py-3 text-sm font-medium leading-snug text-emerald-100/95 shadow-inner shadow-emerald-500/10">
              <span className="font-semibold text-white">Use your Refyndra password</span> — the password you created for
              this app. <span className="font-semibold text-white">Do not enter your Gmail password here.</span> Order sync
              uses a separate 16-character Google step inside your dashboard.
            </p>
          )}
          <div>
            <label htmlFor="auth-email" className="mb-1 block text-sm font-medium text-[var(--muted)]">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="mb-1 block text-sm font-medium text-[var(--muted)]">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              placeholder={isSignUp ? 'Choose a password' : 'Your Refyndra password'}
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--accent)] px-4 py-3 text-sm font-bold text-[var(--background)] transition-colors hover:bg-[var(--accent-muted)] disabled:opacity-60"
          >
            {loading ? (isSignUp ? 'Creating account…' : 'Signing in…') : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          {isSignUp ? (
            <>
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-[var(--accent)] hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New to Refyndra?{' '}
              <Link href="/signup" className="font-semibold text-[var(--accent)] hover:underline">
                Create an account
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
