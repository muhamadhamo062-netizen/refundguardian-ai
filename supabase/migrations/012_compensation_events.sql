-- Priority Engine / desktop guidance: log confirmations before OpenAI integration.

CREATE TABLE IF NOT EXISTS public.compensation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'priority_engine',
  platform_key TEXT NOT NULL,
  provider TEXT NOT NULL,
  auto_issue_type TEXT NOT NULL,
  optional_issue_types TEXT[] NOT NULL DEFAULT '{}',
  message_preview TEXT NOT NULL,
  estimated_refund_cents INTEGER,
  metadata JSONB DEFAULT '{}',
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compensation_events_user_created
  ON public.compensation_events(user_id, created_at DESC);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS compensation_processed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.compensation_processed_at IS
  'Set when user confirms guidance for this order (Priority Engine or future flows).';

ALTER TABLE public.compensation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own compensation_events" ON public.compensation_events;
CREATE POLICY "Users insert own compensation_events"
  ON public.compensation_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users select own compensation_events" ON public.compensation_events;
CREATE POLICY "Users select own compensation_events"
  ON public.compensation_events
  FOR SELECT
  USING (auth.uid() = user_id);

GRANT ALL ON TABLE public.compensation_events TO authenticated;
GRANT ALL ON TABLE public.compensation_events TO service_role;
