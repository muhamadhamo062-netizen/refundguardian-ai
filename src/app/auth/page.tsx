import { Suspense } from 'react';
import { RedirectIfAuthed } from '@/components/auth/RedirectIfAuthed';
import { UnifiedAuthForm } from './UnifiedAuthForm';

export default function AuthPage() {
  return (
    <RedirectIfAuthed>
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--background)]">
        <Suspense fallback={<div className="text-[var(--muted)]">Loading…</div>}>
          <UnifiedAuthForm />
        </Suspense>
      </div>
    </RedirectIfAuthed>
  );
}
