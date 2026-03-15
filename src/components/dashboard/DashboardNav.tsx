'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '@/app/actions/auth';
import { InstallButton } from '@/components/pwa/InstallButton';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/refund-history', label: 'Refund History' },
  { href: '/pricing', label: 'Pricing' },
];

export function DashboardNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="border-b border-[var(--border)] bg-[var(--background)]">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="text-lg font-semibold tracking-tight text-white hover:text-[var(--accent)] transition-colors"
        >
          RefundGuardian AI
        </Link>
        <ul className="hidden md:flex items-center gap-6">
          {links.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`text-sm font-medium transition-colors ${
                    isActive ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-white'
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
          <form action={signOut} className="hidden sm:block">
            <button
              type="submit"
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
            >
              Sign out
            </button>
          </form>
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
            {links.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-4 py-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--card)]"
                >
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <form action={signOut}>
                <button
                  type="submit"
                  className="w-full rounded-lg px-4 py-3 text-left text-sm font-medium text-[var(--foreground)] hover:bg-[var(--card)]"
                >
                  Sign out
                </button>
              </form>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
