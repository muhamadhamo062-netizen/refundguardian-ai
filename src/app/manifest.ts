import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RefundGuardian AI',
    short_name: 'RefundGuardian',
    description:
      'Stop losing money on late deliveries. Our AI scans receipts, detects delays, and files refund claims for you.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0b0d',
    theme_color: '#0a0b0d',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

