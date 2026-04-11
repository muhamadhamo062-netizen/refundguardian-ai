-- Refyndra AI — Point orders.user_id FK at auth.users (if table was created with public.users FK).
-- Safe to re-run: drops default name constraint and re-adds.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
