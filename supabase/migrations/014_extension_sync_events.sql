-- Audit trail when the Chrome extension notifies the app after a successful order batch POST.
-- RLS: users see and insert only their own rows.

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

CREATE POLICY "Users read own extension sync events"
  ON public.extension_sync_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own extension sync events"
  ON public.extension_sync_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.extension_sync_events TO authenticated;
