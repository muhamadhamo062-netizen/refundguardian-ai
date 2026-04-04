'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export function SignupForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Please enter email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    try {
      setLoading(true);
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (signUpError) {
        console.error(signUpError.message);
        setError(signUpError.message);
        setLoading(false);
        return;
      }
      window.location.href = '/dashboard';
    } catch (err) {
      console.error('Sign up error:', err);
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="text-center">
        <Link href="/" translate="no" className="text-2xl font-bold text-white hover:text-[var(--accent)]">
          RefundGuardian AI
        </Link>
        <h1 className="mt-6 text-2xl font-bold text-white">Create account</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Enter your email and a password to get started. New accounts include a free trial window (no
          subscription charge until you choose a paid plan in the dashboard).
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8">
        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label htmlFor="signup-email" className="block text-xs font-medium text-[var(--muted)] mb-1">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-white placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="signup-password" className="block text-xs font-medium text-[var(--muted)] mb-1">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-white placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              placeholder="••••••••"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">At least 6 characters</p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--accent)] px-4 py-3 text-sm font-medium text-[var(--background)] hover:bg-[var(--accent-muted)] transition-colors disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-[var(--muted)]">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-[var(--accent)] hover:underline">
          Sign in
        </Link>
      </p>
      <p className="text-center text-sm text-[var(--muted)]">
        <Link href="/" className="hover:text-[var(--accent)]">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
