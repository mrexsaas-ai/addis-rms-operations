CREATE OR REPLACE FUNCTION public.create_pending_payment(p_order_id uuid, p_method text, p_account_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_restaurant_id uuid;
  v_method text := upper(trim(coalesce(p_method, '')));
  v_enabled_methods text[];
  v_order record;
  v_account record;
  v_payment_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '42501'; END IF;
  SELECT restaurant_id INTO v_restaurant_id FROM public.restaurant_users WHERE user_id = auth.uid() ORDER BY created_at ASC LIMIT 1;
  IF NOT FOUND OR NOT public.has_restaurant_role(v_restaurant_id, array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']) THEN RAISE EXCEPTION 'Active restaurant service access is required.' USING ERRCODE = '42501'; END IF;
  IF v_method NOT IN ('TELEBIRR', 'BANK_TRANSFER') THEN RAISE EXCEPTION 'Only configured Telebirr or bank transfer can be pending.' USING ERRCODE = '22023'; END IF;
  SELECT enabled_payment_methods INTO v_enabled_methods FROM public.restaurant_settings WHERE restaurant_id = v_restaurant_id;
  IF NOT FOUND THEN v_enabled_methods := array['CASH']; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(v_enabled_methods) AS enabled(method_name)
    WHERE upper(trim(enabled.method_name)) = v_method OR (v_method = 'BANK_TRANSFER' AND upper(trim(enabled.method_name)) = 'CBE')) THEN
    RAISE EXCEPTION 'This payment method is not enabled.' USING ERRCODE = '23514';
  END IF;

  SELECT id, total, status INTO v_order FROM public.orders WHERE id = p_order_id AND restaurant_id = v_restaurant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found in this restaurant.' USING ERRCODE = 'P0002'; END IF;
  IF v_order.status IN ('CANCELLED', 'PAID') OR v_order.total <= 0 THEN RAISE EXCEPTION 'This order cannot accept a pending payment.' USING ERRCODE = '23514'; END IF;

  SELECT id, account_number, type INTO v_account FROM public.payment_accounts
  WHERE restaurant_id = v_restaurant_id AND type = v_method AND is_active = true
    AND (p_account_id IS NULL OR id = p_account_id) AND nullif(trim(account_number), '') IS NOT NULL
  ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active payment account is configured.' USING ERRCODE = '23514'; END IF;
  IF EXISTS (SELECT 1 FROM public.payments WHERE restaurant_id = v_restaurant_id AND order_id = p_order_id AND status = 'COMPLETED') THEN
    RAISE EXCEPTION 'This order has already been paid.' USING ERRCODE = '23514';
  END IF;

  SELECT id INTO v_payment_id FROM public.payments
  WHERE restaurant_id = v_restaurant_id AND order_id = p_order_id AND method = v_method AND status = 'PENDING' LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('payment_id', v_payment_id, 'amount', v_order.total, 'created', false); END IF;

  INSERT INTO public.payments (restaurant_id, order_id, amount, method, status, received_by)
  VALUES (v_restaurant_id, p_order_id, v_order.total, v_method, 'PENDING', auth.uid()) RETURNING id INTO v_payment_id;
  INSERT INTO public.payment_audit_events (restaurant_id, payment_id, order_id, actor_user_id, action, metadata)
  VALUES (v_restaurant_id, v_payment_id, p_order_id, auth.uid(), 'PAYMENT_CREATED', jsonb_build_object('method', v_method, 'account_id', v_account.id, 'status', 'PENDING'));
  RETURN jsonb_build_object('payment_id', v_payment_id, 'amount', v_order.total, 'created', true);
END;
$$;

REVOKE ALL ON FUNCTION public.create_pending_payment(uuid, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_pending_payment(uuid, text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
