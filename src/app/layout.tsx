// FINAL_AI_LAUNCH_APRIL_14
// DEPLOY_ID: 638194205
// Mobile update v2 - 2026-04-11T18:30:00Z
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import { getPublicSiteUrl } from '@/lib/siteUrl';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

const SITE_TITLE =
  'Refyndra | Get Money Back from Late Deliveries Automatically (Amazon, Uber, DoorDash)';
const SITE_DESCRIPTION =
  'Stop letting big brands keep your money. Refyndra is an AI-powered tool that automatically detects late deliveries and secures refunds for you. No manual effort, no hidden fees.';

const KEYWORDS: string[] = [
  'Amazon late delivery compensation',
  'Uber Eats refund hacks',
  'DoorDash credit for late orders',
  'get money back from Amazon without return',
  'passive income AI tools',
  'consumer rights USA',
  'Refyndra AI',
  'Amazon refunds',
  'late delivery help',
  'Uber trip delay compensation',
  'automated Amazon refunds',
];

export const metadata: Metadata = {
  metadataBase: new URL(getPublicSiteUrl()),
  title: {
    default: SITE_TITLE,
    template: '%s | Refyndra',
  },
  description: SITE_DESCRIPTION,
  keywords: KEYWORDS,
  applicationName: 'Refyndra',
  authors: [{ name: 'Refyndra' }],
  creator: 'Refyndra',
  publisher: 'Refyndra',
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: getPublicSiteUrl(),
    siteName: 'Refyndra',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: [
      { url: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { url: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icon-192.svg', sizes: '180x180', type: 'image/svg+xml' }],
  },
  themeColor: '#0a0b0d',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-US" dir="ltr" className="dark" suppressHydrationWarning>
      <body
        className="min-h-screen overflow-x-hidden bg-[var(--background)] text-[var(--foreground)] antialiased font-sans"
        suppressHydrationWarning
      >
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
