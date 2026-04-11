'use client';

/** Google’s official App Password help (full walkthrough). */
export const GOOGLE_APP_PASSWORD_GUIDE_URL = 'https://support.google.com/accounts/answer/185833';

/** Clean outline shield — Security. */
function IconShield() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-14 w-14 text-emerald-400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

/** Classic key — Search App Passwords. */
function IconKey() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-14 w-14 text-emerald-400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </svg>
  );
}

/** Check in circle — Generate & Copy. */
function IconCheck() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-14 w-14 text-emerald-400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

const STEPS = [
  { Icon: IconShield, caption: 'Security Tab', step: 1 },
  { Icon: IconKey, caption: 'Search App Passwords', step: 2 },
  { Icon: IconCheck, caption: 'Generate & Copy', step: 3 },
] as const;

/**
 * Horizontal snap row: three fixed-width cards, emerald glass styling.
 */
export function MobileSyncVisualStrip() {
  return (
    <div className="mx-auto w-full max-w-lg space-y-3">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-400/90">
        Quick setup · swipe
      </p>
      <div className="flex w-full justify-center">
        <div
          className="flex max-w-full flex-row flex-nowrap snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-pl-4 scroll-pr-4 px-2 pb-2 pt-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
          role="list"
          aria-label="App password setup steps"
        >
          {STEPS.map(({ Icon, caption, step }) => (
            <div
              key={step}
              role="listitem"
              className="w-[280px] max-w-[85vw] shrink-0 snap-center"
            >
              <div className="flex min-h-[10rem] flex-col items-center justify-between rounded-xl border border-emerald-500/30 bg-zinc-950/60 px-4 py-4 text-center shadow-inner shadow-black/40 backdrop-blur-md">
                <span className="text-[10px] font-bold tabular-nums text-emerald-400/95">{step}</span>
                <div className="flex flex-col items-center justify-center gap-3 py-2">
                  <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/25">
                    <Icon />
                  </div>
                  <p className="text-[12px] font-semibold leading-snug text-zinc-100">{caption}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <a
        href={GOOGLE_APP_PASSWORD_GUIDE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mx-auto flex min-h-[44px] w-full max-w-lg touch-manipulation items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
      >
        Full Visual Guide
      </a>
    </div>
  );
}
