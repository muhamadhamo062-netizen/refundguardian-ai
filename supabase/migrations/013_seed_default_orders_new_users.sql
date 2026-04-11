-- ============================================================================
-- Refyndra AI — Default “welcome” orders for every new auth user (all US platforms)
--
-- Why not SERIAL users + orders.user_email?
-- Supabase Auth owns identities in auth.users (UUID). This app uses public.orders.user_id
-- → auth.users(id). See 001_initial_schema.sql (public.users profile) and 006/007/008 (orders).
--
-- This migration:
-- 1) Inserts 4 placeholder rows (amazon, uber_eats, uber, doordash) when a row is added to auth.users.
-- 2) Marks them in raw_email so you can filter or replace them after real sync.
--
-- Apply with: npx supabase db push   OR   paste into Supabase SQL Editor (run after earlier migrations).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Idempotent: drop trigger/function if re-running in dev
DROP TRIGGER IF EXISTS on_auth_user_created_rg_seed_orders ON auth.users;
DROP FUNCTION IF EXISTS public.rg_handle_new_user_seed_orders();

CREATE OR REPLACE FUNCTION public.rg_handle_new_user_seed_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- One burst per signup (trigger fires once per auth.users insert)
  INSERT INTO public.orders (
    user_id,
    provider,
    order_id,
    order_date,
    merchant_name,
    order_value_cents,
    currency,
    raw_email
  )
  VALUES
    (
      NEW.id,
      'amazon',
      'rg-seed-welcome-amazon',
      NOW(),
      'Welcome — connect your Amazon orders',
      0,
      'USD',
      jsonb_build_object(
        'rg_seed', true,
        'platform', 'amazon',
        'label', 'Amazon'
      )
    ),
    (
      NEW.id,
      'uber_eats',
      'rg-seed-welcome-ubereats',
      NOW(),
      'Welcome — connect Uber Eats',
      0,
      'USD',
      jsonb_build_object(
        'rg_seed', true,
        'platform', 'uber_eats',
        'label', 'Uber Eats'
      )
    ),
    (
      NEW.id,
      'uber',
      'rg-seed-welcome-uber',
      NOW(),
      'Welcome — connect Uber Rides',
      0,
      'USD',
      jsonb_build_object(
        'rg_seed', true,
        'platform', 'uber',
        'label', 'Uber Rides'
      )
    ),
    (
      NEW.id,
      'doordash',
      'rg-seed-welcome-doordash',
      NOW(),
      'Welcome — connect DoorDash',
      0,
      'USD',
      jsonb_build_object(
        'rg_seed', true,
        'platform', 'doordash',
        'label', 'DoorDash'
      )
    );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.rg_handle_new_user_seed_orders() IS
  'After signup: seed 4 placeholder orders (one per platform) for Refyndra dashboard.';

CREATE TRIGGER on_auth_user_created_rg_seed_orders
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.rg_handle_new_user_seed_orders();
