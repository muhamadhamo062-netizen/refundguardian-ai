import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--background)]">
      <Suspense fallback={<div className="text-[var(--muted)]">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
