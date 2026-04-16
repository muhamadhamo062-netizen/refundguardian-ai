ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS complaint_status TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS complaint_sent_at TIMESTAMPTZ;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS complaint_last_error TEXT;

