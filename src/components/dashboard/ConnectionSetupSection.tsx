'use client';

import dynamic from 'next/dynamic';
import { useLayoutEffect, useState } from 'react';

import { ConnectionSetupSkeleton } from '@/components/dashboard/ConnectionSetupSkeleton';
import type { ExtensionTokenVariant } from '@/components/dashboard/ExtensionToken';

const MOBILE_MQ = '(max-width: 767px)';

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

type Phase = 'boot' | 'mobile' | 'desktop';

/**
 * Conditional rendering: mobile → Gmail App Password UI; desktop/tablet → Chrome extension UI.
 * Uses a stable `boot` phase + dynamic(ssr:false) to avoid React 18 dev Strict Mode / hydration
 * `removeChild` errors when swapping large subtrees.
 */
export function ConnectionSetupSection({ variant = 'dashboard' }: Props) {
  const [phase, setPhase] = useState<Phase>('boot');

  useLayoutEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const apply = () => {
      setPhase(mq.matches ? 'mobile' : 'desktop');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  if (phase === 'boot') {
    return <ConnectionSetupSkeleton />;
  }

  return (
    <div className="min-w-0" suppressHydrationWarning>
      {phase === 'mobile' ? (
        <GmailImapConnect key="rg-setup-gmail" />
      ) : (
        <ExtensionToken key="rg-setup-ext" variant={variant} />
      )}
    </div>
  );
}
