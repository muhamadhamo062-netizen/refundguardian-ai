-- RefundGuardian AI — Track per-user IMAP scan status for UI feedback.
-- Safe to re-run.

ALTER TABLE public.imap_app_credentials
  ADD COLUMN IF NOT EXISTS last_scan_at TIMESTAMPTZ;

ALTER TABLE public.imap_app_credentials
  ADD COLUMN IF NOT EXISTS last_scan_inserted INTEGER NOT NULL DEFAULT 0 CHECK (last_scan_inserted >= 0);

ALTER TABLE public.imap_app_credentials
  ADD COLUMN IF NOT EXISTS last_scan_error TEXT;

