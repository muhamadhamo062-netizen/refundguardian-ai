import { Suspense } from 'react';
import { SignupForm } from './SignupForm';
import { RedirectIfAuthed } from '@/components/auth/RedirectIfAuthed';

export default function SignupPage() {
  return (
    <RedirectIfAuthed>
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--background)]">
        <Suspense fallback={<div className="text-[var(--muted)]">Loading…</div>}>
          <SignupForm />
        </Suspense>
      </div>
    </RedirectIfAuthed>
  );
}
