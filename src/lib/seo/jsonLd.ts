import { ICON_ASSET_VERSION } from '@/lib/iconAssetVersion';
import { getPublicSiteUrl } from '@/lib/siteUrl';
import { LANDING_FAQ_ITEMS } from '@/lib/seo/landingFaq';

/** Optional: set real aggregate review stats from your data source (avoid fake ratings). */
function optionalAggregateRating():
  | { '@type': 'AggregateRating'; ratingValue: string; reviewCount: string; bestRating: string; worstRating: string }
  | undefined {
  const rating = process.env.NEXT_PUBLIC_SCHEMA_RATING_VALUE?.trim();
  const count = process.env.NEXT_PUBLIC_SCHEMA_REVIEW_COUNT?.trim();
  if (!rating || !count) return undefined;
  return {
    '@type': 'AggregateRating',
    ratingValue: rating,
    reviewCount: count,
    bestRating: '5',
    worstRating: '1',
  };
}

export function buildLandingPageJsonLd(): Record<string, unknown> {
  const base = getPublicSiteUrl();
  const icon512 = `${base}/icon-512.svg?v=${ICON_ASSET_VERSION}`;
  const aggregateRating = optionalAggregateRating();

  const software: Record<string, unknown> = {
    '@type': 'SoftwareApplication',
    '@id': `${base}/#software`,
    name: 'Refyndra',
    description:
      'Stop letting big brands keep your money. Refyndra is an AI-powered tool that automatically detects late deliveries and secures refunds for you. No manual effort, no hidden fees.',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    browserRequirements: 'Requires JavaScript. Modern browser recommended.',
    url: base,
    image: icon512,
    offers: {
      '@type': 'Offer',
      price: '9.99',
      priceCurrency: 'USD',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '9.99',
        priceCurrency: 'USD',
        unitText: 'MONTH',
      },
      availability: 'https://schema.org/InStock',
    },
  };
  if (aggregateRating) {
    software.aggregateRating = aggregateRating;
  }

  const faqMainEntity = LANDING_FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.a,
    },
  }));

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${base}/#organization`,
        name: 'Refyndra',
        url: base,
        logo: {
          '@type': 'ImageObject',
          url: icon512,
        },
        sameAs: [],
      },
      {
        '@type': 'WebSite',
        '@id': `${base}/#website`,
        name: 'Refyndra',
        url: base,
        publisher: { '@id': `${base}/#organization` },
        inLanguage: 'en-US',
      },
      software,
      {
        '@type': 'FAQPage',
        '@id': `${base}/#faq`,
        mainEntity: faqMainEntity,
      },
    ],
  };
}
