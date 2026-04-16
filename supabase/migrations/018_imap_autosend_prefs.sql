ALTER TABLE public.imap_app_credentials
  ADD COLUMN IF NOT EXISTS auto_send_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.imap_app_credentials
  ADD COLUMN IF NOT EXISTS auto_send_recipient TEXT;

ALTER TABLE public.imap_app_credentials
  ADD COLUMN IF NOT EXISTS auto_send_from_name TEXT;

