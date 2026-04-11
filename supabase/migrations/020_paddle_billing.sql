-- Paddle Billing (Merchant of Record) — customer/subscription IDs from webhooks
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_users_paddle_customer ON public.users(paddle_customer_id);
