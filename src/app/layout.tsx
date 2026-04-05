import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: 'RefundGuardian AI – Stop Losing Money on Late Deliveries',
  description:
    'Autonomous Compensation Engine — detects delivery and order issues, calculates compensation, and applies enhancements when applicable across Amazon, Uber Eats, and Uber Rides.',
  themeColor: '#0a0b0d',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" className="dark" suppressHydrationWarning>
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

