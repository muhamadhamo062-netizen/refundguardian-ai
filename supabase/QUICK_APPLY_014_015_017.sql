-- =============================================================================
-- RefundGuardian — one-shot apply for IMAP migrations (Supabase SQL Editor)
-- Run when: imap_app_credentials missing, IMAP scan columns missing, or auto-send prefs/backoff columns missing.
-- If a step errors with "already exists", skip that section or fix manually.
-- =============================================================================

-- --- 015 imap_app_credentials (from migrations/015_imap_app_credentials.sql) ---

CREATE TABLE IF NOT EXISTS public.imap_app_credentials (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_address TEXT NOT NULL,
  encrypted_app_password TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imap_app_credentials_updated ON public.imap_app_credentials(updated_at DESC);

ALTER TABLE public.imap_app_credentials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'imap_app_credentials'
      AND policyname = 'Users can read own imap_app_credentials'
  ) THEN
    CREATE POLICY "Users can read own imap_app_credentials"
      ON public.imap_app_credentials FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'imap_app_credentials'
      AND policyname = 'Users can insert own imap_app_credentials'
  ) THEN
    CREATE POLICY "Users can insert own imap_app_credentials"
      ON public.imap_app_credentials FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'imap_app_credentials'
      AND policyname = 'Users can update own imap_app_credentials'
  ) THEN
    CREATE POLICY "Users can update own imap_app_credentials"
      ON public.imap_app_credentials FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'imap_app_credentials'
      AND policyname = 'Users can delete own imap_app_credentials'
  ) THEN
    CREATE POLICY "Users can delete own imap_app_credentials"
      ON public.imap_app_credentials FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

GRANT ALL ON public.imap_app_credentials TO authenticated;

-- --- 017 IMAP scan status columns (from migrations/017_imap_scan_status.sql) ---

ALTER TABLE public.imap_app_credentials
  ADD COLUMN IF NOT EXISTS last_scan_at TIMESTAMPTZ;

ALTER TABLE public.imap_app_credentials
  ADD COLUMN IF NOT EXISTS last_scan_inserted INTEGER NOT NULL DEFAULT 0 CHECK (last_scan_inserted >= 0);

ALTER TABLE public.imap_app_credentials
  ADD COLUMN IF NOT EXISTS last_scan_error TEXT;

-- --- 018 auto-send preferences (from migrations/018_imap_autosend_prefs.sql) ---

ALTER TABLE public.imap_app_credentials
  ADD COLUMN IF NOT EXISTS auto_send_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.imap_app_credentials
  ADD COLUMN IF NOT EXISTS auto_send_recipient TEXT;

ALTER TABLE public.imap_app_credentials
  ADD COLUMN IF NOT EXISTS auto_send_from_name TEXT;

-- --- 020 IMAP scan backoff (from migrations/020_imap_scan_backoff.sql) ---

ALTER TABLE public.imap_app_credentials
  ADD COLUMN IF NOT EXISTS next_scan_after TIMESTAMPTZ;

ALTER TABLE public.imap_app_credentials
  ADD COLUMN IF NOT EXISTS scan_error_streak INTEGER NOT NULL DEFAULT 0 CHECK (scan_error_streak >= 0);
