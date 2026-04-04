-- SaaS billing, free trial, autonomous mode flag, automation audit trail.
-- Replaces refund-trigger-based "subscription activation" with explicit Stripe billing.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'none'
    CHECK (subscription_status IN ('none', 'trialing', 'active', 'past_due', 'canceled')),
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS autonomous_mode_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON public.users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON public.users(subscription_status);

COMMENT ON COLUMN public.users.trial_ends_at IS 'Free trial window end; no payment collected until Stripe checkout.';
COMMENT ON COLUMN public.users.autonomous_mode_enabled IS 'User opt-in for automated claim drafting/logging (PRO); never bypasses merchant APIs.';

-- Automation audit (server-inserted; transparent log)
CREATE TABLE IF NOT EXISTS public.automation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id TEXT,
  platform TEXT,
  issue_type TEXT,
  action TEXT NOT NULL,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_events_user_created ON public.automation_events(user_id, created_at DESC);

ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own automation events"
  ON public.automation_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own automation events"
  ON public.automation_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.automation_events TO authenticated;

ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS claim_channel TEXT NOT NULL DEFAULT 'manual'
    CHECK (claim_channel IN ('manual', 'autonomous_draft', 'api_submitted'));

COMMENT ON COLUMN public.claims.claim_channel IS 'manual = user-driven; autonomous_draft = system-generated draft; api_submitted = submitted via integration layer when available.';

-- Free trial on signup: 14 days from account creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url, trial_ends_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    (NOW() + INTERVAL '14 days')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Billing is Stripe-driven; do not auto-upgrade plan on first refund.
DROP TRIGGER IF EXISTS on_refund_history_activate_sub ON public.refund_history;
DROP FUNCTION IF EXISTS public.activate_subscription_on_first_refund();

-- Backfill trial window for existing accounts (one-time)
UPDATE public.users
SET trial_ends_at = created_at + INTERVAL '14 days'
WHERE trial_ends_at IS NULL;
