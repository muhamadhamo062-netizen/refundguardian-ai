-- User consent for automated compensation monitoring
-- Run in Supabase SQL Editor after 001 and 002

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS consent_given_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_text TEXT;

COMMENT ON COLUMN public.users.consent_given_at IS 'When user accepted: monitor delivery orders and request compensation on their behalf';
