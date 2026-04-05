'use client';

import { GmailSecureSyncGuideImage } from '@/components/dashboard/GmailSecureSyncGuideImage';

const STEPS = [
  {
    pngSrc: '/guides/secure-sync/step-1.png',
    svgFallbackSrc: '/guides/secure-sync/step-1-security.svg',
    alt: 'Step 1: Google Account — Security',
    title: 'Security',
    caption: 'Open your Google Account → Security.',
  },
  {
    pngSrc: '/guides/secure-sync/step-2.png',
    svgFallbackSrc: '/guides/secure-sync/step-2-app-password.svg',
    alt: 'Step 2: App passwords',
    title: 'App passwords',
    caption: 'Choose App passwords and create one for mail access.',
  },
  {
    pngSrc: '/guides/secure-sync/step-3.png',
    svgFallbackSrc: '/guides/secure-sync/step-3-copy.svg',
    alt: 'Step 3: Copy the generated code',
    title: 'Copy code',
    caption: 'Copy the 16-character code Google shows you.',
  },
] as const;

/**
 * 3-step visual guide. Prefer real blurred screenshots:
 * add `step-1.png` … `step-3.png` under `/public/guides/secure-sync/` (see README there).
 * Until then, SVG placeholders load automatically after a failed PNG request.
 */
export function GmailSecureSyncGuide() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Quick setup (3 steps)</p>
      <p className="mt-2 text-[13px] font-medium leading-snug text-zinc-100 sm:text-sm">
        Create a 100% Secure, Read-Only Link. This code only allows our AI to see your receipts, NOT your private
        emails.
      </p>
      <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
        {STEPS.map((step, i) => (
          <figure
            key={step.pngSrc}
            className="w-[min(100%,240px)] flex-shrink-0 snap-start rounded-lg border border-white/10 bg-black/30 p-2"
          >
            <div className="relative mx-auto flex min-h-[200px] w-full max-w-[220px] items-center justify-center overflow-hidden rounded-md bg-black/20">
              <GmailSecureSyncGuideImage
                pngSrc={step.pngSrc}
                svgFallbackSrc={step.svgFallbackSrc}
                alt={step.alt}
              />
            </div>
            <figcaption className="mt-2 text-center">
              <span className="text-[11px] font-medium text-zinc-300">
                {i + 1}. {step.title}
              </span>
              <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">{step.caption}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-1 text-[10px] leading-snug text-zinc-500">
        Real screenshots from your Google Account feel more trustworthy than drawings — blur your email and any
        personal details; keep only the steps visible.
      </p>
    </div>
  );
}
