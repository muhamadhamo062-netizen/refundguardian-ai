const steps = [
  {
    step: 1,
    title: 'Sign up with email',
    description: 'Create your account — free trial starts with a limited AI scan.',
    icon: (
      <svg
        className="h-6 w-6 text-emerald-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5.5 20.5v-9a1 1 0 0 1 .4-.8L11 6l5.1 4.7a1 1 0 0 1 .4.8v9"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 20.5h16M10 20.5v-5a2 2 0 0 1 4 0v5"
        />
      </svg>
    ),
  },
  {
    step: 2,
    title: 'AI scans recent orders',
    description: 'Complimentary pass: recent orders only, small batch — one-time on the free tier.',
    icon: (
      <svg
        className="h-6 w-6 text-teal-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 4h6l2 3h6v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6M9 17h3" />
      </svg>
    ),
  },
  {
    step: 3,
    title: 'Detect issues',
    description: 'Late delivery, missing items, billing errors, quality flags — ranked by value.',
    icon: (
      <svg
        className="h-6 w-6 text-cyan-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l3 3" />
        <circle cx="12" cy="12" r="8" />
      </svg>
    ),
  },
  {
    step: 4,
    title: 'Compensation outcomes',
    description:
      'See estimated compensation and engine output — advisory, transparent; you view results, you do not start the run.',
    icon: (
      <svg
        className="h-6 w-6 text-sky-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m4 4 8 4 8-4-8 16-8-16Z"
        />
      </svg>
    ),
  },
  {
    step: 5,
    title: 'Upgrade for full automation',
    description: 'Unlock unlimited scanning and optional automation via Stripe Checkout — no silent billing.',
    icon: (
      <svg
        className="h-6 w-6 text-emerald-300"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-t border-[var(--border)] bg-[var(--card)] px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-bold text-white sm:text-4xl">How it works</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-[var(--muted)]">
          From signup to a clear upgrade path — you always know what&apos;s free and what&apos;s Pro.
        </p>
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map(({ step, title, description, icon }) => (
            <div
              key={step}
              className="relative flex flex-col items-start rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-sm transition-transform duration-150 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/40"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--card)] ring-1 ring-[var(--border)]">
                {icon}
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                Step {step}
              </p>
              <h3 className="mt-1 text-base font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
