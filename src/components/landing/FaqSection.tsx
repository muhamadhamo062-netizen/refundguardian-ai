'use client';

import { useCallback, useId, useState } from 'react';

import { LANDING_FAQ_ITEMS } from '@/lib/seo/landingFaq';

export function FaqSection() {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = useCallback((i: number) => {
    setOpenIndex((cur) => (cur === i ? null : i));
  }, []);

  return (
    <section
      id="faq"
      className="border-t border-white/[0.06] bg-[var(--background)] px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-3xl">
        <h2 id="faq-heading" className="text-center text-3xl font-bold tracking-tight text-white sm:text-3xl">
          Frequently asked questions
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-base text-[var(--muted)] sm:text-sm">
          Quick answers about safety, devices, savings, and where Refyndra works.
        </p>

        <ul className="mt-10 space-y-3">
          {LANDING_FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            const panelId = `${baseId}-panel-${i}`;
            const buttonId = `${baseId}-btn-${i}`;
            return (
              <li key={item.q} className="rounded-xl border border-[var(--border)] bg-[var(--card)]/80 shadow-sm shadow-black/20">
                <h3 className="m-0">
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggle(i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-white transition hover:bg-white/[0.03] sm:px-6 sm:text-base"
                  >
                    <span>{item.q}</span>
                    <span
                      className={`shrink-0 text-emerald-400/90 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className={isOpen ? 'border-t border-[var(--border)]' : undefined}
                >
                  <p className="px-5 pb-5 pt-3 text-base leading-relaxed text-[var(--muted)] sm:px-6 sm:text-[15px]">
                    {item.a}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
