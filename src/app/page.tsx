// Mobile update v2 - 2026-04-11T18:30:00Z
import type { Metadata } from 'next';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { LandingJsonLd } from '@/components/seo/LandingJsonLd';
import { RefyndraHeroComparison } from '@/components/landing/RefyndraHeroComparison';
import { Hero } from '@/components/landing/Hero';
import { VideoDemo } from '@/components/landing/VideoDemo';
import { TrustSection } from '@/components/landing/TrustSection';
import { Testimonials } from '@/components/landing/Testimonials';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { FinalCta } from '@/components/landing/FinalCta';
import { PricingCards } from '@/components/landing/PricingCards';
import { FaqSection } from '@/components/landing/FaqSection';
import { AiPriorityEngineShowcase } from '@/components/landing/AiPriorityEngineShowcase';

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

export default function LandingPage() {
  return (
    <>
      <LandingJsonLd />
      <Navbar />
      <main>
        <Hero />
        <VideoDemo />
        <TrustSection />
        <Testimonials />
        <HowItWorks />
        <div className="border-t border-white/[0.06] bg-[var(--background)]">
          <div className="mx-auto max-w-7xl space-y-16 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <RefyndraHeroComparison />
          </div>
        </div>
        <section
          id="ai-priority-preview"
          className="border-t border-white/[0.06] bg-[var(--background)]"
          aria-labelledby="ai-priority-preview-heading"
        >
          <h2 id="ai-priority-preview-heading" className="sr-only">
            Automated Amazon refunds and Uber trip delay compensation tools
          </h2>
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <AiPriorityEngineShowcase />
          </div>
        </section>
        <FinalCta />
        <PricingCards />
        <FaqSection />
      </main>
      <Footer />
    </>
  );
}
