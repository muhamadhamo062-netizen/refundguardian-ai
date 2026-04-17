-- Legacy fix: some projects have public.imap_app_credentials without encrypted_app_password
-- (e.g. table created manually or partial apply). PostgREST then errors:
-- "Could not find the 'encrypted_app_password' column ... in the schema cache"
-- Safe to re-run.

ALTER TABLE public.imap_app_credentials
  ADD COLUMN IF NOT EXISTS encrypted_app_password TEXT;

UPDATE public.imap_app_credentials
SET encrypted_app_password = ''
WHERE encrypted_app_password IS NULL;

ALTER TABLE public.imap_app_credentials
  ALTER COLUMN encrypted_app_password SET NOT NULL;

NOTIFY pgrst, 'reload schema';
