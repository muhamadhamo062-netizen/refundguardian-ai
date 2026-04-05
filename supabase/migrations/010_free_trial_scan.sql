-- One-time free AI scan gate for conversion funnel (non-Pro users only).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS free_trial_initial_scan_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.free_trial_initial_scan_completed_at IS
  'When set, free-tier user has used their single complimentary AI batch; upgrade required for more.';
