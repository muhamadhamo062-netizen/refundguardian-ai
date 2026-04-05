import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RefundGuardian AI',
    short_name: 'RefundGuardian',
    description:
      'Stop losing money on late deliveries. Autonomous Compensation Engine scans orders, detects issues, and calculates compensation automatically.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0b0d',
    theme_color: '#0a0b0d',
    icons: [
      {
        src: '/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: '/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
      {
        src: '/icon-512-maskable.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}

