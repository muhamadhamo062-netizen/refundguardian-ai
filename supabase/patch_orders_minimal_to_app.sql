-- ============================================================================
-- If you created a minimal `public.orders` table, add columns the app expects.
-- Run in Supabase SQL Editor once (idempotent). Then refresh the dashboard.
-- Full canonical shape: migrations/006_ensure_orders_complete.sql
-- ============================================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'other';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promised_delivery_time timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS actual_delivery_time timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS email_message_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS email_thread_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS email_subject text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS email_from text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
