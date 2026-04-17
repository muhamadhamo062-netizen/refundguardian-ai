'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Slide = {
  eyebrow: string;
  title: string;
  body: string;
  accent: string;
};

const slides: Slide[] = [
  {
    eyebrow: 'The Hook',
    title: 'Stop Bleeding Thousands of Dollars Every Year.',
    body: 'Companies count on you to forget your refund rights. Our AI ensures you never do.',
    accent: 'from-violet-500/35 via-fuchsia-500/25 to-transparent',
  },
  {
    eyebrow: 'The Logic',
    title: 'Your Delivery History is a Goldmine.',
    body: 'We cross-reference every Amazon, Uber, Uber Eats, and DoorDash order with near real-time tracking to spot hidden compensation signals.',
    accent: 'from-indigo-500/35 via-violet-500/20 to-transparent',
  },
  {
    eyebrow: 'The Key',
    title: 'One Key. Total Privacy.',
    body: 'Use your 16-character Google Sync Code to unlock your dashboard. Encryption-first. Invoice-access only.',
    accent: 'from-fuchsia-500/30 via-violet-500/20 to-transparent',
  },
];

export function OnboardingEntry() {
  const router = useRouter();
  const [index, setIndex] = useState(0);

  const current = slides[index];
  const isLast = index === slides.length - 1;

  const progress = useMemo(() => `${index + 1}/${slides.length}`, [index]);

  const goTo = (next: number) => setIndex(Math.max(0, Math.min(slides.length - 1, next)));

  const complete = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('rg_welcome_seen_v1', '1');
    }
    router.push('/');
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--background)] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(139,92,246,0.35),transparent_36%),radial-gradient(circle_at_90%_20%,rgba(217,70,239,0.24),transparent_42%),radial-gradient(circle_at_50%_100%,rgba(67,56,202,0.25),transparent_40%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-5 py-10 sm:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200/85">Refyndra Elite Access</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.localStorage.setItem('rg_welcome_seen_v1', '1');
                }
              }}
              className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-zinc-200 backdrop-blur-md transition hover:bg-white/[0.1]"
            >
              Skip to site
            </Link>
            <p className="rounded-full border border-violet-300/30 bg-zinc-900/70 px-3 py-1 text-xs text-zinc-200 backdrop-blur">
              {progress}
            </p>
          </div>
        </div>

        <section className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.04] p-6 shadow-[0_0_80px_rgba(109,40,217,0.28)] ring-1 ring-violet-300/25 backdrop-blur-2xl sm:p-10">
          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${current.accent}`} />
          <div className="pointer-events-none absolute -right-10 -top-8 h-40 w-40 rounded-full bg-violet-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-8 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div key={index} className="relative animate-rg-fade-in">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-200/90">{current.eyebrow}</p>
            <h1 className="mt-3 max-w-4xl bg-gradient-to-r from-white via-zinc-100 to-violet-100 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-5xl">
              {current.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-200 sm:text-lg">{current.body}</p>

            <div className="mt-8 flex items-center gap-2">
              {slides.map((_, dot) => (
                <button
                  key={dot}
                  type="button"
                  onClick={() => goTo(dot)}
                  className={`h-2.5 rounded-full transition-all ${
                    dot === index ? 'w-9 bg-violet-300 shadow-[0_0_20px_rgba(196,181,253,0.75)]' : 'w-2.5 bg-zinc-500/90 hover:bg-zinc-300'
                  }`}
                  aria-label={`Go to step ${dot + 1}`}
                />
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {!isLast ? (
                <button
                  type="button"
                  onClick={() => goTo(index + 1)}
                  className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-900/40 hover:brightness-110"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={complete}
                  className="rounded-xl bg-gradient-to-r from-emerald-300 to-emerald-200 px-7 py-3 text-sm font-extrabold text-zinc-950 shadow-lg shadow-emerald-900/35 hover:brightness-105"
                >
                  Get Started
                </button>
              )}
              {index > 0 ? (
                <button
                  type="button"
                  onClick={() => goTo(index - 1)}
                  className="rounded-xl border border-zinc-700 bg-zinc-900/70 px-5 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-800/70"
                >
                  Back
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
