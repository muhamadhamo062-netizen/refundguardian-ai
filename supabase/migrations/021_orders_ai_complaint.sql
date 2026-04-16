-- Persist AI-generated complaint text on orders for cross-device access.
-- Safe to re-run.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ai_complaint TEXT;

