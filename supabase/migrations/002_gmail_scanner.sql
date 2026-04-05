-- RefundGuardian AI - Gmail scanner and AI receipt parser schema

-- orders: normalized orders extracted from email receipts
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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

-- detected_refunds: potential refund opportunities derived from delayed deliveries
CREATE TABLE IF NOT EXISTS public.detected_refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  delay_minutes INTEGER,
  potential_refund_cents INTEGER,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'refunded', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_detected_refunds_user_id ON public.detected_refunds(user_id);
CREATE INDEX IF NOT EXISTS idx_detected_refunds_status ON public.detected_refunds(status);
CREATE INDEX IF NOT EXISTS idx_detected_refunds_created_at ON public.detected_refunds(created_at);

-- gmail_connections: stores OAuth tokens for Gmail API access
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

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detected_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;

-- Policies: users can only access their own rows
CREATE POLICY "Users can CRUD own orders"
  ON public.orders
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own detected_refunds"
  ON public.detected_refunds
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own gmail_connections"
  ON public.gmail_connections
  FOR ALL
  USING (auth.uid() = user_id);

