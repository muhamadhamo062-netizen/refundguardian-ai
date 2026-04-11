'use client';

import { useCallback, useState } from 'react';

const GOOGLE_SECURITY_URL = 'https://myaccount.google.com/security';

/** Full-width mini-scene: Google Account → Security (always visible fills + strokes). */
function IllustrationSecurity() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 320 180"
      className="h-auto w-full max-h-[min(200px,42vw)] min-h-[140px] select-none"
      aria-hidden
    >
      <defs>
        <linearGradient id="gsg-shine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#064e3b" />
          <stop offset="100%" stopColor="#022c22" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" rx="14" fill="#0a0f0d" />
      <rect x="10" y="10" width="300" height="160" rx="10" fill="url(#gsg-shine)" stroke="#34d399" strokeOpacity="0.35" strokeWidth="1.5" />
      {/* Browser chrome */}
      <rect x="22" y="22" width="276" height="28" rx="6" fill="#0f172a" />
      <circle cx="36" cy="36" r="4" fill="#f87171" />
      <circle cx="52" cy="36" r="4" fill="#fbbf24" />
      <circle cx="68" cy="36" r="4" fill="#4ade80" />
      <text x="160" y="40" textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="system-ui,sans-serif">
        myaccount.google.com
      </text>
      {/* Shield badge */}
      <path
        d="M160 58 L200 72 V110 C200 130 160 148 160 148 C160 148 120 130 120 110 V72 Z"
        fill="#065f46"
        stroke="#34d399"
        strokeWidth="2"
      />
      <path d="M160 78 V118" stroke="#6ee7b7" strokeWidth="2" strokeLinecap="round" />
      <path d="M145 98 H175" stroke="#6ee7b7" strokeWidth="2" strokeLinecap="round" />
      <text x="160" y="162" textAnchor="middle" fill="#6ee7b7" fontSize="12" fontWeight="600" fontFamily="system-ui,sans-serif">
        Security
      </text>
    </svg>
  );
}

/** 2FA + App passwords search. */
function Illustration2FA() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 320 180"
      className="h-auto w-full max-h-[min(200px,42vw)] min-h-[140px] select-none"
      aria-hidden
    >
      <rect width="320" height="180" rx="14" fill="#0a0f0d" />
      <rect x="10" y="10" width="300" height="160" rx="10" fill="#0c1a14" stroke="#34d399" strokeOpacity="0.35" strokeWidth="1.5" />
      {/* Lock */}
      <rect x="130" y="48" width="60" height="52" rx="8" fill="#14532d" stroke="#34d399" strokeWidth="2" />
      <path d="M142 48 V38 C142 26 154 18 160 18 C166 18 178 26 178 38 V48" fill="none" stroke="#6ee7b7" strokeWidth="3" strokeLinecap="round" />
      <circle cx="160" cy="78" r="6" fill="#052e16" stroke="#a7f3d0" strokeWidth="2" />
      {/* Toggle ON */}
      <rect x="108" y="118" width="104" height="28" rx="14" fill="#059669" />
      <circle cx="190" cy="132" r="11" fill="#ecfdf5" />
      <text x="160" y="168" textAnchor="middle" fill="#86efac" fontSize="10" fontFamily="system-ui,sans-serif">
        2-Step ON · then search App Passwords
      </text>
      <rect x="50" y="138" width="220" height="24" rx="6" fill="#1e293b" stroke="#475569" strokeWidth="1" />
      <text x="160" y="154" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="ui-monospace,monospace">
        App Passwords
      </text>
    </svg>
  );
}

/** Generate 16-char code. */
function IllustrationKey() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 320 180"
      className="h-auto w-full max-h-[min(200px,42vw)] min-h-[140px] select-none"
      aria-hidden
    >
      <rect width="320" height="180" rx="14" fill="#0a0f0d" />
      <rect x="10" y="10" width="300" height="160" rx="10" fill="#0c1a14" stroke="#34d399" strokeOpacity="0.35" strokeWidth="1.5" />
      {/* Key */}
      <circle cx="118" cy="96" r="22" fill="none" stroke="#34d399" strokeWidth="3" />
      <path d="M138 96 H248 L260 84 L272 96 L260 108 L248 96" fill="#065f46" stroke="#6ee7b7" strokeWidth="2" strokeLinejoin="round" />
      <rect x="52" y="128" width="216" height="36" rx="8" fill="#14532d" stroke="#34d399" strokeWidth="1.5" />
      <text
        x="160"
        y="151"
        textAnchor="middle"
        fill="#a7f3d0"
        fontSize="13"
        fontFamily="ui-monospace,monospace"
        letterSpacing="0.12em"
      >
        xxxx xxxx xxxx xxxx
      </text>
      <text x="160" y="42" textAnchor="middle" fill="#86efac" fontSize="11" fontWeight="600" fontFamily="system-ui,sans-serif">
        Other · Refyndra
      </text>
    </svg>
  );
}

const STEPS = [
  {
    Illustration: IllustrationSecurity,
    title: 'Security',
    body: 'Go to your Google Account > Security.',
  },
  {
    Illustration: Illustration2FA,
    title: '2FA & App Passwords',
    body: 'Ensure 2-Step Verification is ON, then search for "App Passwords".',
  },
  {
    Illustration: IllustrationKey,
    title: 'Generate',
    body: 'Select "Other", name it "Refyndra", and copy your 16-character code.',
  },
] as const;

type Props = {
  compact?: boolean;
};

export function GmailSecureSyncGuide({ compact = false }: Props) {
  const [copied, setCopied] = useState(false);

  const copySecurityLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_SECURITY_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div
      className={`rounded-2xl border border-[var(--border)] bg-[var(--background)]/40 ${compact ? 'p-3' : 'p-4 sm:p-5'}`}
      aria-labelledby="app-password-guide-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h4 id="app-password-guide-heading" className="text-sm font-semibold text-zinc-100">
            How to get your App Password
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Three quick steps in your Google Account. Your code stays private — we encrypt it after you paste.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copySecurityLink()}
          className="shrink-0 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
      <div
        className={`mt-5 grid grid-cols-1 gap-4 md:mt-6 md:grid-cols-3 md:gap-5 ${compact ? 'max-md:gap-5' : ''}`}
      >
        {STEPS.map((step, i) => {
          const Art = step.Illustration;
          return (
            <figure
              key={step.title}
              className="flex w-full min-w-0 flex-col items-stretch overflow-hidden rounded-xl border border-emerald-500/35 bg-[#050806] text-center shadow-md shadow-black/30 md:border-[var(--border)] md:bg-[#0a0c10]"
            >
              <div className="relative w-full overflow-hidden bg-gradient-to-b from-emerald-950/50 to-[#050806] px-2 pt-3 pb-1">
                <div className="mx-auto w-full max-w-[320px]">
                  <Art />
                </div>
              </div>
              <figcaption className="px-4 py-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400">
                  Step {i + 1} · {step.title}
                </span>
                <p className="mt-2 text-left text-[13px] leading-snug text-zinc-200 sm:text-sm">{step.body}</p>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
