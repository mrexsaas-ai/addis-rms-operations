CREATE OR REPLACE FUNCTION public.record_completed_payment(
  p_order_id uuid, p_amount numeric, p_method text, p_reference_number text, p_cash_received numeric
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_restaurant_id uuid;
  v_method text := upper(trim(coalesce(p_method, '')));
  v_enabled_methods text[];
  v_order record;
  v_item_total numeric(12,2);
  v_item_count bigint;
  v_cash_received numeric(12,2);
  v_payment_id uuid;
  v_confirmed_at timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '42501'; END IF;
  SELECT restaurant_id INTO v_restaurant_id FROM public.restaurant_users WHERE user_id = auth.uid() ORDER BY created_at ASC LIMIT 1;
  IF NOT FOUND OR NOT public.has_restaurant_role(v_restaurant_id, array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']) THEN RAISE EXCEPTION 'Active restaurant service access is required.' USING ERRCODE = '42501'; END IF;
  IF v_method NOT IN ('CASH', 'TELEBIRR', 'BANK_TRANSFER') THEN RAISE EXCEPTION 'Choose a supported payment method.' USING ERRCODE = '22023'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount::text = 'NaN' THEN RAISE EXCEPTION 'Payment amount must be positive.' USING ERRCODE = '22023'; END IF;

  SELECT enabled_payment_methods INTO v_enabled_methods FROM public.restaurant_settings WHERE restaurant_id = v_restaurant_id;
  IF NOT FOUND THEN v_enabled_methods := array['CASH']; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(v_enabled_methods) AS enabled(method_name)
    WHERE upper(trim(enabled.method_name)) = v_method OR (v_method = 'BANK_TRANSFER' AND upper(trim(enabled.method_name)) = 'CBE')) THEN
    RAISE EXCEPTION 'This payment method is not enabled.' USING ERRCODE = '23514';
  END IF;

  SELECT id, total, status INTO v_order FROM public.orders
  WHERE id = p_order_id AND restaurant_id = v_restaurant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found in this restaurant.' USING ERRCODE = 'P0002'; END IF;
  IF v_order.status IN ('CANCELLED', 'PAID') OR v_order.total <= 0 THEN RAISE EXCEPTION 'This order cannot be paid.' USING ERRCODE = '23514'; END IF;
  SELECT count(*), coalesce(sum(subtotal), 0) INTO v_item_count, v_item_total FROM public.order_items
  WHERE order_id = p_order_id AND restaurant_id = v_restaurant_id;
  IF v_item_count = 0 OR v_item_total <> v_order.total THEN RAISE EXCEPTION 'Order lines do not match the order total.' USING ERRCODE = '23514'; END IF;
  IF EXISTS (SELECT 1 FROM public.payments WHERE restaurant_id = v_restaurant_id AND order_id = p_order_id AND status = 'COMPLETED') THEN
    RAISE EXCEPTION 'This order has already been paid.' USING ERRCODE = '23514';
  END IF;
  IF v_method <> 'CASH' AND (p_amount <> v_order.total OR nullif(trim(p_reference_number), '') IS NULL) THEN
    RAISE EXCEPTION 'Non-cash payment must match the order total and include a reference.' USING ERRCODE = '23514';
  END IF;
  v_cash_received := coalesce(p_cash_received, p_amount, 0);
  IF v_method = 'CASH' AND v_cash_received < v_order.total THEN RAISE EXCEPTION 'Cash received must cover the order total.' USING ERRCODE = '23514'; END IF;

  INSERT INTO public.payments (restaurant_id, order_id, amount, method, status, received_by, confirmed_by, confirmed_at, reference_number, cash_received, change_amount)
  VALUES (v_restaurant_id, p_order_id, v_order.total, v_method, 'COMPLETED', auth.uid(), auth.uid(), v_confirmed_at,
    nullif(trim(p_reference_number), ''), CASE WHEN v_method = 'CASH' THEN v_cash_received ELSE NULL END,
    CASE WHEN v_method = 'CASH' THEN greatest(v_cash_received - v_order.total, 0) ELSE NULL END)
  RETURNING id INTO v_payment_id;

  UPDATE public.orders SET status = 'PAID', updated_at = v_confirmed_at
  WHERE id = p_order_id AND restaurant_id = v_restaurant_id;

  INSERT INTO public.payment_audit_events (restaurant_id, payment_id, order_id, actor_user_id, action, metadata)
  VALUES (v_restaurant_id, v_payment_id, p_order_id, auth.uid(), 'PAYMENT_CONFIRMED',
    jsonb_build_object('method', v_method, 'amount', v_order.total, 'reference_number', nullif(trim(p_reference_number), ''), 'confirmed_at', v_confirmed_at));
  RETURN v_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_completed_payment(uuid, numeric, text, text, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_completed_payment(uuid, numeric, text, text, numeric) TO authenticated;

NOTIFY pgrst, 'reload schema';
