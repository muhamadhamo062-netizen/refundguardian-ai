import { Suspense } from 'react';
import { LoginForm } from './LoginForm';
import { RedirectIfAuthed } from '@/components/auth/RedirectIfAuthed';

export default function LoginPage() {
  return (
    <RedirectIfAuthed>
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--background)]">
        <Suspense fallback={<div className="text-[var(--muted)]">Loading…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </RedirectIfAuthed>
  );
}
