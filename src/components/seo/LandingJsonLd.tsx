import { buildLandingPageJsonLd } from '@/lib/seo/jsonLd';

/** JSON-LD for the marketing homepage (Organization, WebSite, SoftwareApplication, FAQPage). */
export function LandingJsonLd() {
  const json = buildLandingPageJsonLd();
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
