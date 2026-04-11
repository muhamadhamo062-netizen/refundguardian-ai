-- Strict tenant isolation: authenticated users may only read/write rows where user_id = auth.uid().
-- WITH CHECK ensures INSERT/UPDATE cannot assign another user's id.

-- ----- orders -----
DROP POLICY IF EXISTS "Users can CRUD own orders" ON public.orders;
CREATE POLICY "orders_tenant_isolation"
  ON public.orders
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ----- notifications -----
DROP POLICY IF EXISTS "Users can CRUD own notifications" ON public.notifications;
CREATE POLICY "notifications_tenant_isolation"
  ON public.notifications
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ----- detected_refunds -----
DROP POLICY IF EXISTS "Users can CRUD own detected_refunds" ON public.detected_refunds;
CREATE POLICY "detected_refunds_tenant_isolation"
  ON public.detected_refunds
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "orders_tenant_isolation" ON public.orders IS
  'RLS: each row visible only to auth.uid() = user_id; enforced on INSERT/UPDATE via WITH CHECK.';
COMMENT ON POLICY "notifications_tenant_isolation" ON public.notifications IS
  'RLS: each row visible only to auth.uid() = user_id.';
COMMENT ON POLICY "detected_refunds_tenant_isolation" ON public.detected_refunds IS
  'RLS: each row visible only to auth.uid() = user_id.';
