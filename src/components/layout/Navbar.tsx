'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { InstallButton } from '@/components/pwa/InstallButton';
import { createClient } from '@/lib/supabase/client';

const baseLinks = [
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/pricing', label: 'Pricing' },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const supabase = createClient();

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error(error.message);
      if (!alive) return;
      setIsAuthed(!!data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setIsAuthed(!!session);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const navLinks = useMemo(() => {
    // Keep the Dashboard link stable to avoid “first click does nothing” while auth state is loading.
    // If the user isn't authed, /dashboard will redirect to /login server-side.
    return [...baseLinks, { href: '/dashboard', label: 'Dashboard' }];
  }, []);

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) console.error(error.message);
    } finally {
      setMobileOpen(false);
      router.replace('/login');
      router.refresh();
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          translate="no"
          className="text-lg font-semibold tracking-tight text-white hover:text-[var(--accent)] transition-colors"
        >
          RefundGuardian AI
        </Link>

        <ul className="hidden md:flex items-center gap-8">
          {navLinks.map(({ href, label }) => {
            const isActive =
              pathname === href ||
              (href !== '/' && href !== '/#how-it-works' && pathname.startsWith(href));
            return (
              <li key={href}>
                <Link
                  href={href}
                  prefetch={href === '/dashboard'}
                  className={`text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--foreground)]/80 hover:text-white'
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-3">
          <InstallButton />
          {isAuthed ? (
            <button
              type="button"
              onClick={handleLogout}
              className="hidden sm:inline-flex rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/login"
              className="hidden sm:inline-flex rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:bg-[var(--accent-muted)] transition-colors"
            >
              Login
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden rounded-lg p-2 text-[var(--foreground)] hover:bg-[var(--card)]"
            aria-label="Toggle menu"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--background)] px-4 py-4">
          <ul className="flex flex-col gap-2">
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  prefetch={href === '/dashboard'}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-4 py-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--card)]"
                >
                  {label}
                </Link>
              </li>
            ))}
            {isAuthed && (
              <li>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full rounded-lg px-4 py-3 text-left text-sm font-medium text-[var(--foreground)] hover:bg-[var(--card)]"
                >
                  Logout
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </header>
  );
}
