-- =============================================================================
-- Refyndra — one-shot apply for IMAP (migrations 015, 017) + drop legacy ingest table
-- Run when: imap_app_credentials missing, IMAP scan columns missing, or old extension_sync_events exists.
-- If a step errors with "already exists", skip that section or fix manually.
-- =============================================================================

DROP TABLE IF EXISTS public.extension_sync_events CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- --- 022 encrypted_app_password (if table existed without this column) ---

ALTER TABLE public.imap_app_credentials
  ADD COLUMN IF NOT EXISTS encrypted_app_password TEXT;

UPDATE public.imap_app_credentials
SET encrypted_app_password = ''
WHERE encrypted_app_password IS NULL;

ALTER TABLE public.imap_app_credentials
  ALTER COLUMN encrypted_app_password SET NOT NULL;

NOTIFY pgrst, 'reload schema';

-- --- 023 gmail_address column (if 015 was never applied) ---
ALTER TABLE public.imap_app_credentials
  ADD COLUMN IF NOT EXISTS gmail_address TEXT;

NOTIFY pgrst, 'reload schema';
