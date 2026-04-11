-- Refyndra AI — Extend orders for extension -> API ingest (idempotent).
-- - Allow user_id to be NULL (extension ingest without auth).
-- - Add amount (numeric) and raw (jsonb) to match extension payload.
-- - Keep existing columns for the rest of the app.

ALTER TABLE public.orders
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS amount NUMERIC;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS raw JSONB;

-- Ensure FK points to auth.users (canonical Supabase auth table)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

