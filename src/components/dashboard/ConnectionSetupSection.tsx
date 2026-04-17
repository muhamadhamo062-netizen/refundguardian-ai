'use client';

import { GmailImapConnect } from '@/components/dashboard/GmailImapConnect';

type Props = {
  /** Kept for call-site compatibility; sync UI is always a single box. */
  optional?: boolean;
};

export function ConnectionSetupSection(_props: Props) {
  return (
    <div id="gmail-connection" className="min-w-0 scroll-mt-24">
      <GmailImapConnect />
    </div>
  );
}
