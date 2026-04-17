import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        accent: 'var(--accent)',
        'accent-muted': 'var(--accent-muted)',
        border: 'var(--border)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'rg-fade-in': 'rg-fade-in 0.55s ease-out both',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        /** Run AI Scan button — shimmer sweep across the pill */
        'rg-scan-shimmer': 'rg-scan-shimmer 1.85s ease-in-out infinite',
        /** Soft breathing ring on the button while loading */
        'rg-scan-ring': 'rg-scan-ring 2.2s ease-in-out infinite',
      },
      keyframes: {
        'rg-fade-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
        'rg-scan-shimmer': {
          '0%': { transform: 'translateX(-130%) skewX(-14deg)' },
          '100%': { transform: 'translateX(230%) skewX(-14deg)' },
        },
        'rg-scan-ring': {
          '0%, 100%': {
            boxShadow: '0 0 0 0 rgba(0, 212, 170, 0.45)',
          },
          '50%': {
            boxShadow: '0 0 0 8px rgba(0, 212, 170, 0.08)',
          },
        },
      },
    },
  },
  plugins: [],
};
export default config;
