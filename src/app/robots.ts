import type { MetadataRoute } from 'next';

import { getPublicSiteUrl } from '@/lib/siteUrl';

export default function robots(): MetadataRoute.Robots {
  const base = getPublicSiteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/api/', '/_next/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
