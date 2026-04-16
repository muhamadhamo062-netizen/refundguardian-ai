-- Production-grade IMAP cron hardening:
-- - backoff after failures to avoid hammering Gmail / burning cron time
-- - schedule-aware scans via next_scan_after

ALTER TABLE public.imap_app_credentials
  ADD COLUMN IF NOT EXISTS next_scan_after TIMESTAMPTZ;

ALTER TABLE public.imap_app_credentials
  ADD COLUMN IF NOT EXISTS scan_error_streak INTEGER NOT NULL DEFAULT 0 CHECK (scan_error_streak >= 0);

