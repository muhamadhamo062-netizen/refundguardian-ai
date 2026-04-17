import type { MetadataRoute } from 'next';

import { ICON_ASSET_VERSION } from '@/lib/iconAssetVersion';

const v = ICON_ASSET_VERSION;

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Refyndra AI',
    short_name: 'Refyndra',
    description:
      'Get money back from late deliveries automatically. Refyndra detects delays on Amazon, Uber, DoorDash & more — no manual effort, no hidden fees.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0b0d',
    theme_color: '#0a0b0d',
    icons: [
      {
        src: `/icon-192.svg?v=${v}`,
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: `/icon-512.svg?v=${v}`,
        sizes: '512x512',
        type: 'image/svg+xml',
      },
      {
        src: `/icon-512-maskable.svg?v=${v}`,
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}

