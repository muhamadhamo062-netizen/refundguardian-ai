'use client';

import { US_COPY } from '@/lib/usCopy/compensation';

/** Plain-language overview of how Refyndra tracks savings. */
export function CompensationPipelineCard() {
  return (
    <section
      className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)]/80 px-4 py-4 text-sm text-zinc-300 shadow-sm sm:px-5"
      aria-labelledby="pipeline-heading"
    >
      <h2 id="pipeline-heading" className="text-base font-semibold text-zinc-100">
        {US_COPY.pipelineTitle}
      </h2>
      <ul className="mt-3 list-inside list-disc space-y-2 text-[13px] leading-relaxed text-zinc-400">
        {US_COPY.pipelineBody.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>

      <div className="mt-5 border-t border-[var(--border)] pt-4">
        <h3 className="text-sm font-semibold text-zinc-200">{US_COPY.openAiTitle}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">{US_COPY.openAiBody}</p>
      </div>
    </section>
  );
}
