import Link from 'next/link';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/supportContact';

const footerLinks = [
  { href: '/about', label: 'About' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/support', label: 'Support' },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="text-center sm:text-left">
            <p className="text-base text-[var(--muted)] sm:text-sm" translate="no" suppressHydrationWarning>
              © 2026 Refyndra AI. All rights reserved.
            </p>
            <p className="mt-2 text-base sm:text-sm">
              <span className="text-[var(--muted)]">Support: </span>
              <a
                href={SUPPORT_MAILTO}
                className="inline-flex items-center gap-1 rounded-md font-semibold text-emerald-400 underline decoration-emerald-500/50 underline-offset-4 transition hover:text-emerald-300 hover:decoration-emerald-400"
              >
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
          <ul className="flex flex-wrap items-center justify-center gap-6">
            {footerLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-base text-[var(--muted)] hover:text-[var(--accent)] transition-colors sm:text-sm"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
