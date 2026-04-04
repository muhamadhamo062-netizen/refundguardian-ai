'use client';

import { US_COPY } from '@/lib/usCopy/compensation';

/**
 * US English explainer: what runs automatically vs optional OpenAI / webhook letter pipeline.
 */
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
        <p className="mt-3 text-[11px] leading-snug text-zinc-600">
          Developer: set <code className="rounded bg-zinc-800/80 px-1 py-0.5 text-zinc-400">COMPENSATION_LETTER_WEBHOOK_URL</code> on the server and POST to{' '}
          <code className="rounded bg-zinc-800/80 px-1 py-0.5 text-zinc-400">/api/compensation-letter</code> (authenticated) to forward events to your OpenAI or n8n workflow.
        </p>
      </div>
    </section>
  );
}
