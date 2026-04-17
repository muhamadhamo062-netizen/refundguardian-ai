'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '@/app/actions/auth';
import { InstallButton } from '@/components/pwa/InstallButton';
import { RefyndraMark } from '@/components/brand/RefyndraMark';
import { DashboardAiStatusStrip } from '@/components/dashboard/DashboardAiStatusStrip';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/refund-history', label: 'Compensation history' },
  { href: '/pricing', label: 'Pricing' },
];

export function DashboardNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="min-w-0 overflow-x-hidden border-b border-[var(--border)] bg-[var(--background)]">
      <nav className="relative mx-auto flex h-[4.25rem] max-w-7xl min-w-0 items-center justify-between gap-2 px-3 sm:h-16 sm:px-6 lg:px-8">
        <div className="w-10 shrink-0 md:hidden" aria-hidden />
        <Link
          href="/dashboard"
          translate="no"
          className="group absolute left-1/2 top-1/2 flex min-w-0 max-w-[70%] -translate-x-1/2 -translate-y-1/2 flex-col items-center leading-none transition-colors hover:text-[var(--accent)] md:static md:left-auto md:top-auto md:max-w-none md:translate-x-0 md:translate-y-0 md:items-start"
        >
          <span className="flex items-center gap-2 md:gap-2.5">
            <RefyndraMark
              size={34}
              variant="inline"
              className="shrink-0 drop-shadow-[0_0_12px_rgba(16,185,129,0.25)] transition-transform duration-200 group-hover:scale-[1.04]"
              aria-hidden
            />
            <span className="text-2xl font-bold tracking-tight text-white sm:text-lg md:text-xl">Refyndra</span>
          </span>
          <span className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-emerald-400 sm:text-[9px] md:text-[10px]">
            Pro
          </span>
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
        <div className="z-10 flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          <DashboardAiStatusStrip />
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
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">AI engine</p>
          <div className="mb-4">
            <DashboardAiStatusStrip />
          </div>
          <ul className="flex flex-col gap-2">
            {links.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-4 py-4 !text-lg !font-bold !leading-tight text-[var(--foreground)] hover:bg-[var(--card)] sm:py-3 sm:!text-base sm:font-semibold"
                >
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <form action={signOut}>
                <button
                  type="submit"
                  className="w-full rounded-lg px-4 py-4 text-left !text-lg !font-bold !leading-tight text-[var(--foreground)] hover:bg-[var(--card)] sm:py-3 sm:!text-base sm:font-semibold"
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
