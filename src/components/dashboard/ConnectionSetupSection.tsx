'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { ConnectionSetupSkeleton } from '@/components/dashboard/ConnectionSetupSkeleton';
import type { ExtensionTokenVariant } from '@/components/dashboard/ExtensionToken';

const GmailImapConnect = dynamic(
  () =>
    import('@/components/dashboard/GmailImapConnect').then((m) => ({ default: m.GmailImapConnect })),
  { ssr: false, loading: () => <ConnectionSetupSkeleton /> }
);

const ExtensionToken = dynamic(
  () =>
    import('@/components/dashboard/ExtensionToken').then((m) => ({ default: m.ExtensionToken })),
  { ssr: false, loading: () => <ConnectionSetupSkeleton /> }
);

type Props = {
  variant?: ExtensionTokenVariant;
};

const DESKTOP_MEDIA = '(min-width: 768px)';
const GOOGLE_APP_PASSWORD_HOWTO = 'https://support.google.com/accounts/answer/185833';

export function ConnectionSetupSection({ variant = 'dashboard' }: Props) {
  const [ready, setReady] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(DESKTOP_MEDIA);
    const apply = () => {
      setIsDesktop(mq.matches);
      setReady(true);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  if (!ready) {
    return <ConnectionSetupSkeleton />;
  }

  if (isDesktop) {
    return (
      <div className="min-w-0">
        <section aria-labelledby="connect-extension-heading" className="min-w-0 space-y-4">
          <div>
            <h3 id="connect-extension-heading" className="text-sm font-semibold text-white">
              Quick Start Guide
            </h3>
            <p className="mt-1 text-xs text-zinc-500">Get Refyndra watching your orders in three steps.</p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            <li className="rounded-xl border border-[var(--border)] bg-[var(--card)]/80 px-4 py-3">
              <span className="text-[10px] font-bold text-emerald-400">1</span>
              <p className="mt-1 text-sm font-medium text-zinc-100">Add Refyndra to Chrome</p>
              <p className="mt-0.5 text-xs text-zinc-500">Use the button below to install or connect.</p>
            </li>
            <li className="rounded-xl border border-[var(--border)] bg-[var(--card)]/80 px-4 py-3">
              <span className="text-[10px] font-bold text-emerald-400">2</span>
              <p className="mt-1 text-sm font-medium text-zinc-100">Connect & start</p>
              <p className="mt-0.5 text-xs text-zinc-500">Sign in and let Refyndra link to your session.</p>
            </li>
            <li className="rounded-xl border border-[var(--border)] bg-[var(--card)]/80 px-4 py-3">
              <span className="text-[10px] font-bold text-emerald-400">3</span>
              <p className="mt-1 text-sm font-medium text-zinc-100">Keep this tab open</p>
              <p className="mt-0.5 text-xs text-zinc-500">We sync while you shop on supported sites.</p>
            </li>
          </ol>
          <ExtensionToken variant={variant} />
        </section>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <section
        id="refyndra-mobile-sync"
        aria-labelledby="mobile-sync-heading"
        className="min-w-0 scroll-mt-28 space-y-4"
      >
        <div>
          <h3 id="mobile-sync-heading" className="text-lg font-semibold tracking-tight text-white sm:text-base">
            Refyndra Mobile Sync
          </h3>
          <p className="mt-2 text-base font-semibold leading-snug text-emerald-50 sm:text-sm sm:font-medium sm:text-emerald-100/95">
            Your phone is now a refund hunter. No app install needed. 100% Secure & Automated.
          </p>
        </div>
        <ol className="grid gap-3">
          <li className="rounded-xl border border-[var(--border)] bg-[var(--card)]/85 px-4 py-3.5">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-300 sm:text-[10px] sm:text-emerald-400">Step 1</p>
            <p className="mt-1 text-base font-bold text-zinc-50 sm:text-sm sm:font-semibold sm:text-zinc-100">Enable Secure Access</p>
            <p className="mt-1.5 text-base leading-relaxed text-zinc-200 sm:text-xs sm:text-zinc-400">
              Generate a unique 16-character App Password from your Google account.{' '}
              <a
                href={GOOGLE_APP_PASSWORD_HOWTO}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-emerald-400 underline decoration-emerald-500/50 underline-offset-2 hover:text-emerald-300"
              >
                How to
              </a>
            </p>
          </li>
          <li className="rounded-xl border border-[var(--border)] bg-[var(--card)]/85 px-4 py-3.5">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-300 sm:text-[10px] sm:text-emerald-400">Step 2</p>
            <p className="mt-1 text-base font-bold text-zinc-50 sm:text-sm sm:font-semibold sm:text-zinc-100">Link your Receipts</p>
            <p className="mt-1.5 text-base leading-relaxed text-zinc-200 sm:text-xs sm:text-zinc-400">
              Paste your secure code below. Refyndra encrypts this to only read delivery timestamps.
            </p>
          </li>
          <li className="rounded-xl border border-[var(--border)] bg-[var(--card)]/85 px-4 py-3.5">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-300 sm:text-[10px] sm:text-emerald-400">Step 3</p>
            <p className="mt-1 text-base font-bold text-zinc-50 sm:text-sm sm:font-semibold sm:text-zinc-100">Automatic Recovery Active</p>
            <p className="mt-1.5 text-base leading-relaxed text-zinc-200 sm:text-xs sm:text-zinc-400">
              Sit back. We&apos;ll hunt for refunds in your Gmail 24/7 and notify you the second we win.
            </p>
          </li>
        </ol>
        <GmailImapConnect variant="mobileSync" />
      </section>
    </div>
  );
}
