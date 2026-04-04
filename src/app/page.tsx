import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { RefundRadarHeroComparison } from '@/components/landing/RefundRadarHeroComparison';
import { Hero } from '@/components/landing/Hero';
import { VideoDemo } from '@/components/landing/VideoDemo';
import { TrustSection } from '@/components/landing/TrustSection';
import { Testimonials } from '@/components/landing/Testimonials';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { FinalCta } from '@/components/landing/FinalCta';
import { PricingCards } from '@/components/landing/PricingCards';
import { AiPriorityEngineTable } from '@/components/shared/AiPriorityEngineTable';

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <VideoDemo />
        <TrustSection />
        <Testimonials />
        <HowItWorks />
        <div className="border-t border-white/[0.06] bg-[var(--background)]">
          <div className="mx-auto max-w-7xl space-y-16 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <RefundRadarHeroComparison />
          </div>
        </div>
        <div className="border-t border-white/[0.06] bg-[var(--background)]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <AiPriorityEngineTable />
          </div>
        </div>
        <FinalCta />
        <PricingCards />
      </main>
      <Footer />
    </>
  );
}
