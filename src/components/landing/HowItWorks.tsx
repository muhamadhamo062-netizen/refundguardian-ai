const steps = [
  {
    step: 1,
    title: 'Connect your email',
    description: 'Securely link your inbox so we can spot delivery and ride receipts.',
  },
  {
    step: 2,
    title: 'AI scans receipts automatically',
    description: 'Our system finds eligible late deliveries and delayed rides.',
  },
  {
    step: 3,
    title: 'AI files refund claims for you',
    description: 'We submit claims on your behalf and track them until you get paid.',
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-t border-[var(--border)] bg-[var(--card)] px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="text-3xl font-bold text-white sm:text-4xl text-center">
          How It Works
        </h2>
        <div className="mt-16 grid gap-12 sm:grid-cols-3">
          {steps.map(({ step, title, description }) => (
            <div
              key={step}
              className="relative rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 text-center"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)]/20 text-[var(--accent)] font-bold text-lg">
                {step}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
