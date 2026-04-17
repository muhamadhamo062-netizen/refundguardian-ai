-- Treat "recovered" like "refunded" for refund success notifications + public landing aggregates.

CREATE OR REPLACE FUNCTION public.notify_order_refunded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  should_notify boolean := false;
  new_ok boolean;
  old_ok boolean;
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

  new_ok := lower(trim(COALESCE(NEW.status, ''))) IN ('refunded', 'recovered');

  IF TG_OP = 'INSERT' THEN
    should_notify := new_ok;
  ELSIF TG_OP = 'UPDATE' THEN
    old_ok := lower(trim(COALESCE(OLD.status, ''))) IN ('refunded', 'recovered');
    should_notify := new_ok AND NOT old_ok;
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

COMMENT ON COLUMN public.orders.status IS
  'Lifecycle: active, pending, delivered, cancelled, refunded, recovered, etc. When set to refunded or recovered (case-insensitive), a refund_success_upgrade notification is queued.';

-- Aggregates for marketing / GET /api/stats/public (called with service role only from the app).
CREATE OR REPLACE FUNCTION public.get_public_landing_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_recovered_cents',
      COALESCE(
        (
          SELECT SUM(
            CASE
              WHEN COALESCE(o.refund_amount_cents, 0) > 0 THEN o.refund_amount_cents
              WHEN lower(trim(COALESCE(o.status, ''))) IN ('refunded', 'recovered')
                THEN COALESCE(o.refund_amount_cents, o.order_value_cents, 0)
              ELSE 0
            END
          )::bigint
          FROM public.orders o
        ),
        0
      ),
    'successful_compensations',
      COALESCE(
        (
          SELECT COUNT(*)::bigint
          FROM public.orders o2
          WHERE COALESCE(o2.refund_amount_cents, 0) > 0
            OR lower(trim(COALESCE(o2.status, ''))) IN ('refunded', 'recovered')
        ),
        0
      ),
    'total_users',
      COALESCE((SELECT COUNT(*)::bigint FROM public.users u), 0)
  );
$$;

REVOKE ALL ON FUNCTION public.get_public_landing_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_landing_stats() TO service_role;
