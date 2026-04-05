-- Encrypted Gmail App Password (IMAP) per user — same user_id as extension-synced orders.
-- Server encrypts plaintext before insert; DB stores ciphertext only.

CREATE TABLE IF NOT EXISTS public.imap_app_credentials (
  -- Canonical Supabase Auth user id (matches JWT sub / auth.uid()).
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_address TEXT NOT NULL,
  encrypted_app_password TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imap_app_credentials_updated ON public.imap_app_credentials(updated_at DESC);

ALTER TABLE public.imap_app_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own imap_app_credentials"
  ON public.imap_app_credentials
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own imap_app_credentials"
  ON public.imap_app_credentials
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own imap_app_credentials"
  ON public.imap_app_credentials
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own imap_app_credentials"
  ON public.imap_app_credentials
  FOR DELETE
  USING (auth.uid() = user_id);
