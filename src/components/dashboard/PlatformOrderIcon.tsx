import type { RefundPlatform } from '@/lib/refundPriorityEngine';

const sizes = {
  default:
    'h-8 w-8 [&_svg]:h-[18px] [&_svg]:w-[18px]',
  compact:
    'h-5 w-5 [&_svg]:h-3.5 [&_svg]:w-3.5',
} as const;

const wrapBase =
  'flex shrink-0 items-center justify-center rounded-lg ring-1';

/** Compact platform glyph for “Your orders” — fixed box for alignment with headings and toggles. */
export function PlatformOrderIcon({
  platform,
  size = 'default',
}: {
  platform: RefundPlatform;
  size?: keyof typeof sizes;
}) {
  const wrap = `${wrapBase} ${sizes[size]}`;
  switch (platform) {
    case 'amazon':
      return (
        <span
          className={`${wrap} bg-orange-500/15 text-orange-200 ring-orange-500/30`}
          aria-hidden
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 10.5V19a1 1 0 001 1h4v-5h6v5h4a1 1 0 001-1v-8.5M4 10.5L12 5l8 5.5M9 21v-6h6v6"
            />
          </svg>
        </span>
      );
    case 'uber_eats':
      return (
        <span
          className={`${wrap} bg-emerald-500/15 text-emerald-200 ring-emerald-500/30`}
          aria-hidden
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3v3M6 9h12l-1 9H7L6 9zm0 0V6a3 3 0 016 0v3"
            />
          </svg>
        </span>
      );
    case 'uber_rides':
      return (
        <span className={`${wrap} bg-zinc-600/50 text-white ring-zinc-500/40`} aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 17h14l-1-7H6l-1 7zM5 17v2M19 17v2M7 10l1.5-3h7L17 10"
            />
          </svg>
        </span>
      );
    case 'doordash':
      return (
        <span className={`${wrap} bg-rose-500/15 text-rose-200 ring-rose-500/35`} aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 10h4l2-4h8v10a2 2 0 01-2 2H8M4 10v8a2 2 0 002 2h2M20 8v10"
            />
          </svg>
        </span>
      );
  }
}
