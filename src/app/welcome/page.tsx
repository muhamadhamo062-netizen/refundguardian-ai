import type { Metadata } from 'next';
import { OnboardingEntry } from '@/components/onboarding/OnboardingEntry';

export const metadata: Metadata = {
  title: 'Welcome',
  alternates: {
    canonical: '/welcome',
  },
};

export default function WelcomePage() {
  return <OnboardingEntry />;
}
