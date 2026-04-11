-- Order refund detection → in-app notification row (email sent by app cron via Resend).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS refund_amount_cents INTEGER;

COMMENT ON COLUMN public.orders.status IS
  'Lifecycle: active, pending, delivered, cancelled, refunded, etc. When set to refunded (case-insensitive), a refund_success_upgrade notification is queued.';
COMMENT ON COLUMN public.orders.refund_amount_cents IS
  'Actual refund amount in cents when status becomes refunded (optional; falls back to order_value_cents).';

CREATE INDEX IF NOT EXISTS idx_orders_user_status ON public.orders (user_id, status);

CREATE OR REPLACE FUNCTION public.notify_order_refunded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  should_notify boolean := false;
  platform_label text;
  amt int;
  uname text;
  preview text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    should_notify := lower(trim(COALESCE(NEW.status, ''))) = 'refunded';
  ELSIF TG_OP = 'UPDATE' THEN
    should_notify :=
      lower(trim(COALESCE(NEW.status, ''))) = 'refunded'
      AND lower(trim(COALESCE(OLD.status, ''))) <> 'refunded';
  END IF;

  IF NOT should_notify THEN
    RETURN NEW;
  END IF;

  platform_label := CASE NEW.provider
    WHEN 'amazon' THEN 'Amazon'
    WHEN 'uber_eats' THEN 'Uber Eats'
    WHEN 'uber' THEN 'Uber'
    WHEN 'doordash' THEN 'DoorDash'
    ELSE initcap(COALESCE(NEW.provider, 'merchant'))
  END;

  amt := COALESCE(NEW.refund_amount_cents, NEW.order_value_cents, 0);

  SELECT COALESCE(NULLIF(trim(u.full_name), ''), split_part(u.email, '@', 1), 'there')
  INTO uname
  FROM public.users u
  WHERE u.id = NEW.user_id;

  IF uname IS NULL THEN
    uname := 'there';
  END IF;

  preview := 'We confirmed your refund is back in your balance — open Refyndra to upgrade to Pro.';

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.user_id,
    'refund_success_upgrade',
    'Check your ' || platform_label || ' Account! We got your money back 💰',
    preview,
    jsonb_build_object(
      'order_id', NEW.id,
      'provider', NEW.provider,
      'platform_label', platform_label,
      'amount_cents', amt,
      'merchant_name', NEW.merchant_name,
      'user_display_name', uname,
      'email_sent', false
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_refund_notify ON public.orders;
CREATE TRIGGER orders_refund_notify
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_order_refunded();
