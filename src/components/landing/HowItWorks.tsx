const steps = [
  {
    step: 1,
    title: 'Initial sync (one-time)',
    description:
      "Activate our Smart-Seed feature once. Refyndra instantly maps your history so the AI knows exactly what it's hunting for.",
    icon: (
      <svg
        className="h-6 w-6 text-emerald-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 12h4l2-6 4 12 2-6h6"
        />
      </svg>
    ),
  },
  {
    step: 2,
    title: 'Silent monitoring',
    description:
      'After Gmail is linked, scans run on a schedule in the background. You can open the dashboard anytime to review opportunities and drafts.',
    icon: (
      <svg
        className="h-6 w-6 text-teal-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3a9 9 0 1 0 9 9M12 3v4M12 21v-4M3 12h4M21 12h-4"
        />
        <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    step: 3,
    title: 'Auto-Pilot',
    description: `Receive 'Cha-ching' alerts. We'll notify you the second a refund is secured. Sit back and watch your balance grow.`,
    icon: (
      <svg
        className="h-6 w-6 text-cyan-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 4h16v12H5.17L4 17.17V4Zm4 4h8M4 20h16"
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
        <h2 className="text-center text-4xl font-bold text-white sm:text-4xl">How it works</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-base text-[var(--muted)] sm:text-base">
          Set it and forget it — Refyndra keeps watching so you don’t have to.
        </p>
        <p className="mx-auto mt-6 max-w-3xl rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-5 py-4 text-center text-base font-semibold leading-snug text-emerald-100 sm:text-lg">
          One click today = Automatic refunds forever.
        </p>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map(({ step, title, description, icon }) => (
            <div
              key={step}
              className="relative flex flex-col items-start rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-sm transition-transform duration-150 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/40"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--card)] ring-1 ring-[var(--border)]">
                {icon}
              </div>
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)] sm:text-xs">
                Step {step}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-white sm:text-base">{title}</h3>
              <p className="mt-2 text-base leading-relaxed text-[var(--muted)] sm:text-sm">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
