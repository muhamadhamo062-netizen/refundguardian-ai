-- RefundGuardian AI — Ensure public.orders exists (idempotent, safe to re-run).
-- user_id references auth.users(id) — canonical Supabase Auth user id (matches JWT sub).
-- If you already created orders with FK to public.users, run 007_orders_user_id_auth_users.sql.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_provider ON public.orders(provider);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON public.orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON public.orders(order_id);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own orders" ON public.orders;
CREATE POLICY "Users can CRUD own orders"
  ON public.orders
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON TABLE public.orders TO authenticated;
GRANT ALL ON TABLE public.orders TO service_role;
