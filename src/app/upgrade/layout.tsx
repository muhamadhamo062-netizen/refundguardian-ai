import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export default function UpgradeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="min-h-[70vh] bg-[var(--background)] px-4 py-16 sm:px-6 lg:px-8">{children}</main>
      <Footer />
    </>
  );
}
