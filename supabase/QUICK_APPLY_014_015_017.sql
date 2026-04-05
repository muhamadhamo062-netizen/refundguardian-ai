-- =============================================================================
-- RefundGuardian — one-shot apply for migrations 014, 015, 017 (Supabase SQL Editor)
-- Run when: extension_sync_events missing, imap_app_credentials missing, or IMAP scan columns missing.
-- If a step errors with "already exists", skip that section or fix manually.
-- =============================================================================

-- --- 014 extension_sync_events (from migrations/014_extension_sync_events.sql) ---

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.extension_sync_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  order_count INTEGER NOT NULL DEFAULT 0 CHECK (order_count >= 0),
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extension_sync_user_created
  ON public.extension_sync_events(user_id, created_at DESC);

COMMENT ON TABLE public.extension_sync_events IS 'Extension-originated sync notifications (e.g. after POST /api/orders batch).';

ALTER TABLE public.extension_sync_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'extension_sync_events'
      AND policyname = 'Users read own extension sync events'
  ) THEN
    CREATE POLICY "Users read own extension sync events"
      ON public.extension_sync_events FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'extension_sync_events'
      AND policyname = 'Users insert own extension sync events'
  ) THEN
    CREATE POLICY "Users insert own extension sync events"
      ON public.extension_sync_events FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT ALL ON public.extension_sync_events TO authenticated;

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
