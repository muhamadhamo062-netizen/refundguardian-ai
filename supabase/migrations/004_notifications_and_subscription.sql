-- Notify user when compensation is received; activate subscription after first compensation

CREATE OR REPLACE FUNCTION public.notify_compensation_received()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.user_id,
    'compensation_received',
    'Compensation recovered',
    'We successfully recovered compensation for your delayed order.',
    jsonb_build_object('refund_id', NEW.id, 'amount_cents', NEW.amount_cents, 'provider', NEW.provider)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_refund_history_notify ON public.refund_history;
CREATE TRIGGER on_refund_history_notify
  AFTER INSERT ON public.refund_history
  FOR EACH ROW EXECUTE FUNCTION public.notify_compensation_received();

-- Activate subscription after first successful compensation (business model: free trial until first win)
CREATE OR REPLACE FUNCTION public.activate_subscription_on_first_refund()
RETURNS TRIGGER AS $$
DECLARE
  refund_count integer;
BEGIN
  SELECT COUNT(*) INTO refund_count FROM public.refund_history WHERE user_id = NEW.user_id;
  IF refund_count = 1 THEN
    INSERT INTO public.subscriptions (user_id, plan, status)
    VALUES (NEW.user_id, 'monthly', 'active')
    ON CONFLICT (user_id) DO UPDATE SET status = 'active', updated_at = NOW();
    UPDATE public.users SET plan = 'monthly', updated_at = NOW() WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_refund_history_activate_sub ON public.refund_history;
CREATE TRIGGER on_refund_history_activate_sub
  AFTER INSERT ON public.refund_history
  FOR EACH ROW EXECUTE FUNCTION public.activate_subscription_on_first_refund();
