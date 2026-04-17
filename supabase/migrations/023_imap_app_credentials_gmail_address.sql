-- Fix PGRST204: "Could not find the 'gmail_address' column of 'imap_app_credentials' in the schema cache"
-- Happens when the table was created by a partial migration (e.g. only 022) without 015.
-- Run in Supabase SQL Editor if `supabase db push` is not used.

ALTER TABLE public.imap_app_credentials
  ADD COLUMN IF NOT EXISTS gmail_address TEXT;

COMMENT ON COLUMN public.imap_app_credentials.gmail_address IS 'Lowercase Gmail address for IMAP/SMTP (from migration 015).';

NOTIFY pgrst, 'reload schema';
