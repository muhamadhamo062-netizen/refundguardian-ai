/** Landing FAQ — shared by `FaqSection` and JSON-LD `FAQPage` schema. */
export const LANDING_FAQ_ITEMS: readonly { q: string; a: string }[] = [
  {
    q: 'Is this legal and safe?',
    a: 'Absolutely. Refyndra only automates the consumer rights already provided by merchants like Amazon and Uber. We use bank-level encryption and never see your credit card or personal messages. Refyndra NEVER stores your primary password; we use encrypted App Passwords to keep your account 100% secure.',
  },
  {
    q: 'Do I need a computer to use Refyndra?',
    a: 'No. Connect Gmail with a Secure App Password from any device — iPhone, Android, or desktop — using the same account.',
  },
  {
    q: 'How much can I actually recover?',
    a: "It depends on your order history. Many users recover their entire annual subscription fee within the first month. If we don't find you money, you can cancel anytime.",
  },
  {
    q: 'Which platforms do you support?',
    a: 'Currently, we support Amazon, Uber Eats, Uber Rides, and DoorDash. We are constantly adding more platforms to maximize your refunds.',
  },
] as const;
