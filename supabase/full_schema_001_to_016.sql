-- ============================================================================
-- Refyndra AI — FULL SCHEMA (migrations 001–016 consolidated)
-- Run ONCE in Supabase SQL Editor on a project that has auth.users (Supabase Auth).
-- Idempotent where possible (IF NOT EXISTS / DROP IF EXISTS). Safe to re-run only
-- if you understand partial failures; prefer fresh project or backup first.
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 001 — Core profile + receipts + claims + refund_history + notifications + subscriptions
-- 003 — consent columns (merged into CREATE)
-- 009 — billing / trial / automation_events + users billing columns (merged)
-- 010 — free_trial_initial_scan_completed_at (merged)
-- 011 — trial_used + last_trial_scan_potential_cents (merged)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'monthly', 'annual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consent_given_at TIMESTAMPTZ,
  consent_text TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'none'
    CHECK (subscription_status IN ('none', 'trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at TIMESTAMPTZ,
  autonomous_mode_enabled BOOLEAN NOT NULL DEFAULT false,
  free_trial_initial_scan_completed_at TIMESTAMPTZ,
  trial_used BOOLEAN NOT NULL DEFAULT false,
  last_trial_scan_potential_cents INTEGER
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_plan ON public.users(plan);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON public.users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON public.users(subscription_status);

COMMENT ON COLUMN public.users.consent_given_at IS 'When user accepted: monitor delivery orders and request compensation on their behalf';
COMMENT ON COLUMN public.users.trial_ends_at IS 'Free trial window end; no payment collected until Stripe checkout.';
COMMENT ON COLUMN public.users.autonomous_mode_enabled IS 'User opt-in for automated claim drafting/logging (PRO); never bypasses merchant APIs.';
COMMENT ON COLUMN public.users.free_trial_initial_scan_completed_at IS
  'When set, free-tier user has used their single complimentary AI batch; upgrade required for more.';
COMMENT ON COLUMN public.users.trial_used IS 'True after the single complimentary AI scan for non-Pro users; locks further free AI.';
COMMENT ON COLUMN public.users.last_trial_scan_potential_cents IS 'Sum of advisory estimated refunds (cents) from the completed free scan.';

CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('amazon', 'uber_ride', 'uber_eats', 'other')),
  order_id TEXT,
  amount_cents INTEGER,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scanned', 'claimed', 'refunded', 'ignored')),
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON public.receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_source ON public.receipts(source);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON public.receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON public.receipts(created_at);
CREATE INDEX IF NOT EXISTS idx_receipts_user_created ON public.receipts(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receipt_id UUID REFERENCES public.receipts(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected', 'refunded')),
  amount_cents INTEGER,
  currency TEXT DEFAULT 'USD',
  reference_id TEXT,
  notes TEXT,
  claim_channel TEXT NOT NULL DEFAULT 'manual'
    CHECK (claim_channel IN ('manual', 'autonomous_draft', 'api_submitted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.claims.claim_channel IS 'manual = user-driven; autonomous_draft = system-generated draft; api_submitted = submitted via integration layer when available.';

CREATE INDEX IF NOT EXISTS idx_claims_user_id ON public.claims(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_receipt_id ON public.claims(receipt_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_created_at ON public.claims(created_at);
CREATE INDEX IF NOT EXISTS idx_claims_user_created ON public.claims(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.refund_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  provider TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_history_user_id ON public.refund_history(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_history_completed_at ON public.refund_history(completed_at);
CREATE INDEX IF NOT EXISTS idx_refund_history_user_completed ON public.refund_history(user_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read_at TIMESTAMPTZ,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'monthly', 'annual')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- -----------------------------------------------------------------------------
-- 002 + 006 + 007 + 008 + 012 — orders (FK auth.users, nullable user_id, extension ingest columns)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('amazon', 'uber', 'uber_eats', 'doordash', 'other')),
  order_id TEXT,
  order_date TIMESTAMPTZ,
  promised_delivery_time TIMESTAMPTZ,
  actual_delivery_time TIMESTAMPTZ,
  order_value_cents INTEGER,
  currency TEXT DEFAULT 'USD',
  merchant_name TEXT,
  email_message_id TEXT,
  email_thread_id TEXT,
  email_subject TEXT,
  email_from TEXT,
  raw_email JSONB,
  amount NUMERIC,
  raw JSONB,
  compensation_processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.orders.compensation_processed_at IS
  'Set when user confirms guidance for this order (Priority Engine or future flows).';

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_provider ON public.orders(provider);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON public.orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON public.orders(order_id);

-- -----------------------------------------------------------------------------
-- 002 + 016 — detected_refunds (includes letter_text)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.detected_refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  delay_minutes INTEGER,
  potential_refund_cents INTEGER,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'refunded', 'dismissed')),
  letter_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.detected_refunds.letter_text IS 'Optional US English compensation letter generated by OpenAI when delay > threshold.';

CREATE INDEX IF NOT EXISTS idx_detected_refunds_user_id ON public.detected_refunds(user_id);
CREATE INDEX IF NOT EXISTS idx_detected_refunds_status ON public.detected_refunds(status);
CREATE INDEX IF NOT EXISTS idx_detected_refunds_created_at ON public.detected_refunds(created_at);

-- -----------------------------------------------------------------------------
-- 002 — gmail_connections
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gmail_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  scope TEXT,
  token_type TEXT,
  expiry_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gmail_connections_user_id ON public.gmail_connections(user_id);

-- -----------------------------------------------------------------------------
-- 009 — automation_events
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 012 — compensation_events
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compensation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'priority_engine',
  platform_key TEXT NOT NULL,
  provider TEXT NOT NULL,
  auto_issue_type TEXT NOT NULL,
  optional_issue_types TEXT[] NOT NULL DEFAULT '{}',
  message_preview TEXT NOT NULL,
  estimated_refund_cents INTEGER,
  metadata JSONB DEFAULT '{}',
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compensation_events_user_created
  ON public.compensation_events(user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 015 — imap_app_credentials
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.imap_app_credentials (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  gmail_address TEXT NOT NULL,
  encrypted_app_password TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imap_app_credentials_updated ON public.imap_app_credentials(updated_at DESC);

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detected_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compensation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imap_app_credentials ENABLE ROW LEVEL SECURITY;

-- Policies (drop if re-running)
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can CRUD own receipts" ON public.receipts;
CREATE POLICY "Users can CRUD own receipts" ON public.receipts FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own claims" ON public.claims;
CREATE POLICY "Users can CRUD own claims" ON public.claims FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own refund_history" ON public.refund_history;
CREATE POLICY "Users can read own refund_history" ON public.refund_history FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own notifications" ON public.notifications;
CREATE POLICY "Users can CRUD own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
CREATE POLICY "Users can read own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own subscription" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own orders" ON public.orders;
CREATE POLICY "Users can CRUD own orders"
  ON public.orders
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own detected_refunds" ON public.detected_refunds;
CREATE POLICY "Users can CRUD own detected_refunds"
  ON public.detected_refunds
  FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own gmail_connections" ON public.gmail_connections;
CREATE POLICY "Users can CRUD own gmail_connections"
  ON public.gmail_connections
  FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own automation events" ON public.automation_events;
DROP POLICY IF EXISTS "Users insert own automation events" ON public.automation_events;
CREATE POLICY "Users read own automation events"
  ON public.automation_events FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own automation events"
  ON public.automation_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own compensation_events" ON public.compensation_events;
DROP POLICY IF EXISTS "Users select own compensation_events" ON public.compensation_events;
CREATE POLICY "Users insert own compensation_events"
  ON public.compensation_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users select own compensation_events"
  ON public.compensation_events
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own imap_app_credentials" ON public.imap_app_credentials;
DROP POLICY IF EXISTS "Users can insert own imap_app_credentials" ON public.imap_app_credentials;
DROP POLICY IF EXISTS "Users can update own imap_app_credentials" ON public.imap_app_credentials;
DROP POLICY IF EXISTS "Users can delete own imap_app_credentials" ON public.imap_app_credentials;
CREATE POLICY "Users can read own imap_app_credentials"
  ON public.imap_app_credentials FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own imap_app_credentials"
  ON public.imap_app_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own imap_app_credentials"
  ON public.imap_app_credentials FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own imap_app_credentials"
  ON public.imap_app_credentials FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- Grants
-- =============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.receipts TO authenticated;
GRANT ALL ON public.claims TO authenticated;
GRANT ALL ON public.refund_history TO authenticated;
GRANT ALL ON public.notifications TO authenticated;
GRANT ALL ON public.subscriptions TO authenticated;
GRANT ALL ON TABLE public.orders TO authenticated;
GRANT ALL ON TABLE public.orders TO service_role;
GRANT ALL ON public.detected_refunds TO authenticated;
GRANT ALL ON public.gmail_connections TO authenticated;
GRANT ALL ON public.automation_events TO authenticated;
GRANT ALL ON TABLE public.compensation_events TO authenticated;
GRANT ALL ON TABLE public.compensation_events TO service_role;
GRANT ALL ON public.imap_app_credentials TO authenticated;

-- =============================================================================
-- 004 — notify on refund_history insert (compensation received notification)
-- 009 — drop legacy subscription auto-activation on refund (Stripe-driven billing)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.notify_compensation_received()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.user_id,
    'compensation_received',
    'Compensation recovered',
    'We successfully recovered compensation for your delayed order.',
    jsonb_build_object('refund_id', NEW.id, 'amount_cents', NEW.amount_cents, 'provider', NEW.provider)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_refund_history_notify ON public.refund_history;
CREATE TRIGGER on_refund_history_notify
  AFTER INSERT ON public.refund_history
  FOR EACH ROW EXECUTE FUNCTION public.notify_compensation_received();

DROP TRIGGER IF EXISTS on_refund_history_activate_sub ON public.refund_history;
DROP FUNCTION IF EXISTS public.activate_subscription_on_first_refund();

-- =============================================================================
-- 009 — handle_new_user: profile + 14-day trial (replaces 001 version)
-- =============================================================================
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 013 — seed 4 welcome orders per new user
-- =============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created_rg_seed_orders ON auth.users;
DROP FUNCTION IF EXISTS public.rg_handle_new_user_seed_orders();

CREATE OR REPLACE FUNCTION public.rg_handle_new_user_seed_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.orders (
    user_id,
    provider,
    order_id,
    order_date,
    merchant_name,
    order_value_cents,
    currency,
    raw_email
  )
  VALUES
    (
      NEW.id,
      'amazon',
      'rg-seed-welcome-amazon',
      NOW(),
      'Welcome — connect your Amazon orders',
      0,
      'USD',
      jsonb_build_object('rg_seed', true, 'platform', 'amazon', 'label', 'Amazon')
    ),
    (
      NEW.id,
      'uber_eats',
      'rg-seed-welcome-ubereats',
      NOW(),
      'Welcome — connect Uber Eats',
      0,
      'USD',
      jsonb_build_object('rg_seed', true, 'platform', 'uber_eats', 'label', 'Uber Eats')
    ),
    (
      NEW.id,
      'uber',
      'rg-seed-welcome-uber',
      NOW(),
      'Welcome — connect Uber Rides',
      0,
      'USD',
      jsonb_build_object('rg_seed', true, 'platform', 'uber', 'label', 'Uber Rides')
    ),
    (
      NEW.id,
      'doordash',
      'rg-seed-welcome-doordash',
      NOW(),
      'Welcome — connect DoorDash',
      0,
      'USD',
      jsonb_build_object('rg_seed', true, 'platform', 'doordash', 'label', 'DoorDash')
    );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.rg_handle_new_user_seed_orders() IS
  'After signup: seed 4 placeholder orders (one per platform) for Refyndra dashboard.';

CREATE TRIGGER on_auth_user_created_rg_seed_orders
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.rg_handle_new_user_seed_orders();

-- =============================================================================
-- 009 + 011 — one-time backfills (safe on fresh DB)
-- =============================================================================
UPDATE public.users
SET trial_ends_at = created_at + INTERVAL '14 days'
WHERE trial_ends_at IS NULL;

UPDATE public.users
SET trial_used = true
WHERE free_trial_initial_scan_completed_at IS NOT NULL AND trial_used = false;

-- -----------------------------------------------------------------------------
-- Safety: if an older DB already had detected_refunds without letter_text (016)
-- -----------------------------------------------------------------------------
ALTER TABLE public.detected_refunds ADD COLUMN IF NOT EXISTS letter_text TEXT;

-- =============================================================================
-- Done
-- =============================================================================
