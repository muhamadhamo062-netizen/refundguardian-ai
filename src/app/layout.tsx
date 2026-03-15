import type { Metadata } from 'next';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'RefundGuardian AI – Stop Losing Money on Late Deliveries',
  description:
    'Our AI automatically detects delays and claims refunds for you.',
  themeColor: '#0a0b0d',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased font-sans">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

