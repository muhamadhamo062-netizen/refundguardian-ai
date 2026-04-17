'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { RefyndraMark } from '@/components/brand/RefyndraMark';
import { InstallButton } from '@/components/pwa/InstallButton';
import { LANDING_PRIMARY_CTA_GLOW } from '@/lib/landingPrimaryCta';
import { createClient } from '@/lib/supabase/client';

const baseLinks = [
  { href: '/welcome', label: 'Why Refyndra' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/terms', label: 'Terms' },
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
      if (error && process.env.NODE_ENV === 'development') {
        console.warn('[Navbar] session', error.message);
      }
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
      if (error && process.env.NODE_ENV === 'development') {
        console.warn('[Navbar] signOut', error.message);
      }
    } finally {
      setMobileOpen(false);
      router.replace('/login');
      router.refresh();
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[var(--background)]/60 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--background)]/50">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          translate="no"
          className="group flex min-w-0 shrink-0 items-center gap-2.5 sm:gap-3"
        >
          <RefyndraMark
            size={34}
            variant="inline"
            className="shrink-0 drop-shadow-[0_0_14px_rgba(139,92,246,0.35)] transition-transform duration-200 group-hover:scale-[1.03]"
            aria-hidden
          />
          <span className="text-xl font-bold !leading-tight tracking-tight text-white transition-colors group-hover:text-[var(--accent)] sm:text-lg sm:font-semibold">
            Refyndra
          </span>
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

        <div className="flex items-center gap-2 sm:gap-3">
          <InstallButton />
          {!isAuthed ? (
            <Link
              href="/signup"
              className={`hidden md:inline-flex rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--background)] hover:bg-[var(--accent-muted)] transition-colors ${LANDING_PRIMARY_CTA_GLOW}`}
            >
              Start Now
            </Link>
          ) : null}
          {isAuthed ? (
            <button
              type="button"
              onClick={handleLogout}
              className="hidden md:inline-flex rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/login"
              className="hidden md:inline-flex rounded-lg border border-white/10 bg-[var(--background)]/80 px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
            >
              Sign in
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
        <div className="md:hidden border-t border-white/10 bg-[var(--background)]/75 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md">
          <ul className="flex flex-col gap-2">
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  prefetch={href === '/dashboard'}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-4 py-4 !text-lg !font-bold !leading-tight text-[var(--foreground)] hover:bg-[var(--card)] sm:py-3 sm:!text-base sm:font-semibold sm:!leading-normal"
                >
                  {label}
                </Link>
              </li>
            ))}
            {isAuthed ? (
              <li className="border-t border-[var(--border)] pt-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full rounded-lg px-4 py-4 text-left !text-lg !font-bold !leading-tight text-[var(--foreground)] hover:bg-[var(--card)] sm:py-3 sm:!text-base sm:font-semibold"
                >
                  Logout
                </button>
              </li>
            ) : (
              <li className="border-t border-[var(--border)] pt-3">
                <div className="flex flex-col gap-2 px-1">
                  <Link
                    href="/signup"
                    onClick={() => setMobileOpen(false)}
                    className={`inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-3.5 !text-lg !font-bold !leading-tight text-[var(--background)] sm:min-h-[48px] sm:py-3 sm:!text-base sm:font-semibold ${LANDING_PRIMARY_CTA_GLOW}`}
                  >
                    Start Now
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl border border-white/10 bg-[var(--background)]/70 px-4 py-3.5 !text-lg !font-bold !leading-tight text-[var(--foreground)] backdrop-blur-sm transition-all duration-300 ease-out hover:scale-[1.02] hover:border-emerald-500/25 hover:bg-[var(--card)] active:scale-[0.98] sm:min-h-[48px] sm:py-3 sm:!text-base sm:font-semibold"
                  >
                    Sign in
                  </Link>
                </div>
              </li>
            )}
          </ul>
        </div>
      )}
    </header>
  );
}
