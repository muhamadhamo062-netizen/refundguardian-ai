'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    const supabase = createClient();

    async function checkAuth() {
      const { data, error } = await supabase.auth.getSession();
      if (error && process.env.NODE_ENV === 'development') {
        console.warn('[RedirectIfAuthed]', error.message);
      }

      if (!alive) return;

      if (data.session) {
        // Avoid any chance of loops; only redirect away from auth pages.
        if (pathname === '/login' || pathname === '/signup' || pathname === '/auth') {
          router.replace('/dashboard');
          return;
        }
      }

      setChecking(false);
    }

    checkAuth();
    return () => {
      alive = false;
    };
  }, [router, pathname]);

  if (checking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--background)]">
        <div className="text-[var(--muted)]">Checking session…</div>
      </div>
    );
  }

  return <>{children}</>;
}

