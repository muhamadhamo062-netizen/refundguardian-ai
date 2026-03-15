'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export function ExtensionToken() {
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? null);
    });
  }, []);

  const copyToken = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!token) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="text-xs font-medium text-[var(--muted)]">Chrome Extension</p>
      <p className="mt-1 text-sm text-[var(--foreground)]">
        Copy your token and paste it in the extension to link orders to your account.
      </p>
      <button
        type="button"
        onClick={copyToken}
        className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--card-hover)]"
      >
        {copied ? 'Copied!' : 'Copy token for extension'}
      </button>
    </div>
  );
}
