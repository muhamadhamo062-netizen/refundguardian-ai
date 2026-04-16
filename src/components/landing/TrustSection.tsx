import { AnimatedCounter } from '@/components/dashboard/AnimatedCounter';

export function TrustSection() {
  const exampleRefunds = [
    { name: 'John', amount: '$12', provider: 'Amazon' },
    { name: 'Mike', amount: '$7', provider: 'Uber' },
    { name: 'Sarah', amount: '$5', provider: 'Uber Eats' },
  ];

  const steps = [
    {
      title: 'Sign up',
      description: 'Create your account in seconds.',
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
      title: 'Connect Gmail (one time)',
      description: 'Use a Google App Password so we can securely sync order emails.',
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
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 13h6M9 17h3"
          />
        </svg>
      ),
    },
    {
      title: 'We detect delayed orders',
      description: 'Background scans identify delay signals and refund opportunities automatically.',
      icon: (
        <svg
          className="h-6 w-6 text-cyan-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6l3 3"
          />
          <circle cx="12" cy="12" r="8" />
        </svg>
      ),
    },
    {
      title: 'Autonomous Compensation Engine',
      description:
        'Detects issues, determines compensation type, and calculates amounts automatically — with enhancements when conditions qualify.',
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
  ];

  return (
    <section className="border-t border-[var(--border)] bg-[var(--card)]/60 px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 lg:flex-row">
        {/* Social proof */}
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Trusted Results
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3 sm:items-end">
            <div>
              <p className="text-sm font-medium text-[var(--muted)]">
                Total recovered
              </p>
              <p className="mt-1 text-3xl font-bold text-white sm:text-4xl">
                <AnimatedCounter value={2340120} prefix="$" />
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--muted)]">
                Successful compensations
              </p>
              <p className="mt-1 text-2xl font-semibold text-white">
                <AnimatedCounter value={12450} />
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--muted)]">
                Active users
              </p>
              <p className="mt-1 text-2xl font-semibold text-white">
                <AnimatedCounter value={8200} />
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-[var(--muted)] max-w-md">
            RefundGuardian AI runs in the background to catch delays you&apos;d
            usually miss — and turns them into real money back in your pocket.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {exampleRefunds.map(({ name, amount, provider }) => (
              <div
                key={name}
                className="rounded-xl border border-[var(--border)] bg-[var(--background)]/80 px-4 py-3 text-xs shadow-sm transition-transform duration-150 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/40"
              >
                <p className="font-medium text-white">{name}</p>
                <p className="mt-1 text-[var(--muted)]">
                  recovered{' '}
                  <span className="font-semibold text-[var(--accent)]">
                    {amount}
                  </span>{' '}
                  from {provider}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy + 4 steps */}
        <div className="flex-1 space-y-8">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6">
            <h3 className="text-base font-semibold text-white">
              Your Privacy Comes First
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              We only read order and delivery signals to detect issues so the engine can calculate
              compensation automatically.
            </p>
            <p className="mt-3 text-sm font-medium text-[var(--muted)]">
              We NEVER access:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              <li className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4a4 4 0 0 0-4 4v2.5a4 4 0 0 1-.8 2.4L6 15.5A2 2 0 0 0 7.6 19h8.8A2 2 0 0 0 18 15.5l-1.2-1.6a4 4 0 0 1-.8-2.4V8a4 4 0 0 0-4-4Z"
                    />
                  </svg>
                </span>
                <span>Passwords</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/10 text-sky-400">
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 10h14v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8Z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 10V7a3 3 0 0 1 6 0v3"
                    />
                  </svg>
                </span>
                <span>Payment information</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18 18 6"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7 8.5 8.5 7A5.7 5.7 0 0 1 12 5.5 5.5 5.5 0 0 1 17.5 11c0 1.5-.6 2.9-1.6 3.9L12 18.8l-1.1-1"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5.5 11A5.5 5.5 0 0 1 7 8.5"
                    />
                  </svg>
                </span>
                <span>Personal messages</span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6">
            <h3 className="text-base font-semibold text-white">
              How RefundGuardian AI works
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {steps.map((step, index) => (
                <div key={step.title} className="flex gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--card)] ring-1 ring-[var(--border)]">
                    {step.icon}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Step {index + 1}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-white">
                      {step.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

