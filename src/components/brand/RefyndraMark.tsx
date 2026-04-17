'use client';

import { useId } from 'react';

type Props = {
  /** Pixel width & height (square). */
  size?: number;
  className?: string;
  /** Omit squircle background (for use on dark headers where stroke-only reads cleaner). */
  variant?: 'app' | 'inline';
  'aria-hidden'?: boolean;
};

/**
 * Refyndra wordmark icon: abstract R inside a shield + upward return sweep.
 * Gradient violet → emerald. Use `variant="inline"` in nav bars on dark UI.
 */
export function RefyndraMark({ size = 40, className, variant = 'app', 'aria-hidden': ariaHidden }: Props) {
  const uid = useId().replace(/:/g, '');
  const gid = `rfy-${uid}`;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={ariaHidden ?? true}
      focusable="false"
    >
      <defs>
        <linearGradient id={gid} x1="64" y1="48" x2="448" y2="464" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#10B981" />
        </linearGradient>
      </defs>
      {variant === 'app' ? (
        <rect width="512" height="512" rx="112" fill="#0a0b0d" />
      ) : null}
      <path
        d="M256 54 L388 118 C424 186 424 326 388 394 L256 458 L124 394 C88 326 88 186 124 118 L256 54Z"
        stroke={`url(#${gid})`}
        strokeWidth="20"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M176 122 L176 390 M196 122 C315 114 352 210 222 278 L372 390"
        stroke={`url(#${gid})`}
        strokeWidth="32"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M286 292 C358 258 404 196 396 118"
        stroke={`url(#${gid})`}
        strokeWidth="18"
        strokeLinecap="round"
        fill="none"
        opacity={0.95}
      />
    </svg>
  );
}
