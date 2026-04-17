'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const WELCOME_SEEN_KEY = 'rg_welcome_seen_v1';

export function FirstVisitWelcomeGate() {
  const router = useRouter();

  useEffect(() => {
    const seen = window.localStorage.getItem(WELCOME_SEEN_KEY) === '1';
    if (!seen) {
      router.replace('/welcome');
    }
  }, [router]);

  return null;
}
