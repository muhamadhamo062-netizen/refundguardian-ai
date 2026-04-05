-- Strict one-time value discovery: explicit trial_used + stored potential from first scan.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS trial_used BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_trial_scan_potential_cents INTEGER;

COMMENT ON COLUMN public.users.trial_used IS 'True after the single complimentary AI scan for non-Pro users; locks further free AI.';
COMMENT ON COLUMN public.users.last_trial_scan_potential_cents IS 'Sum of advisory estimated refunds (cents) from the completed free scan.';

UPDATE public.users
SET trial_used = true
WHERE free_trial_initial_scan_completed_at IS NOT NULL AND trial_used = false;
