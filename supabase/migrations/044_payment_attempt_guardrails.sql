-- Keep one active provider payment attempt per order without deleting history.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.payments
    WHERE status = 'PENDING'
    GROUP BY restaurant_id, order_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Resolve existing orders with multiple pending payment attempts before applying this migration.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS payments_one_pending_per_order_uidx
  ON public.payments (restaurant_id, order_id)
  WHERE status = 'PENDING';

CREATE OR REPLACE FUNCTION public.resolve_pending_payment(
  p_payment_id uuid,
  p_decision text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_restaurant_id uuid;
  v_payment record;
  v_item_total numeric(12,2);
  v_item_count bigint;
  v_decision text := upper(trim(coalesce(p_decision, '')));
  v_changed_at timestamptz := now();
  v_reference text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '42501';
  END IF;

  IF v_decision NOT IN ('COMPLETED', 'FAILED') THEN
    RAISE EXCEPTION 'Payment decision must be COMPLETED or FAILED.' USING ERRCODE = '22023';
  END IF;

  SELECT restaurant_id
    INTO v_restaurant_id
  FROM public.restaurant_users
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active restaurant management access is required.' USING ERRCODE = '42501';
  END IF;

  IF v_decision = 'COMPLETED' THEN
    IF NOT public.has_restaurant_role(v_restaurant_id, array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']) THEN
      RAISE EXCEPTION 'Active restaurant management access is required.' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.has_restaurant_role(v_restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']) THEN
    RAISE EXCEPTION 'Active restaurant management access is required.' USING ERRCODE = '42501';
  END IF;

  SELECT p.id, p.restaurant_id, p.order_id, p.amount, p.method, p.status, p.reference_number,
         o.total AS order_total, o.status AS order_status
    INTO v_payment
  FROM public.payments p
  JOIN public.orders o ON o.id = p.order_id AND o.restaurant_id = p.restaurant_id
  WHERE p.id = p_payment_id AND p.restaurant_id = v_restaurant_id
  FOR UPDATE OF p, o;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment was not found in this restaurant.' USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.status <> 'PENDING' OR v_payment.amount <= 0 THEN
    RAISE EXCEPTION 'Payment is not pending verification.' USING ERRCODE = '23514';
  END IF;

  IF v_decision = 'COMPLETED' AND v_payment.method <> 'CASH' AND nullif(trim(p_note), '') IS NULL THEN
    RAISE EXCEPTION 'A transaction reference is required for this payment method.' USING ERRCODE = '23514';
  END IF;

  IF v_decision = 'COMPLETED' THEN
    IF v_payment.order_status IN ('CANCELLED', 'PAID') OR v_payment.amount <> v_payment.order_total THEN
      RAISE EXCEPTION 'Pending payment no longer matches a payable order.' USING ERRCODE = '23514';
    END IF;

    SELECT count(*), coalesce(sum(subtotal), 0)
      INTO v_item_count, v_item_total
    FROM public.order_items
    WHERE order_id = v_payment.order_id AND restaurant_id = v_restaurant_id;

    IF v_item_count = 0 OR v_item_total <> v_payment.order_total THEN
      RAISE EXCEPTION 'Order lines do not match the order total.' USING ERRCODE = '23514';
    END IF;
  END IF;

  v_reference := coalesce(nullif(trim(p_note), ''), v_payment.reference_number);

  UPDATE public.payments
  SET status = v_decision,
      reference_number = v_reference,
      confirmed_by = CASE WHEN v_decision = 'COMPLETED' THEN auth.uid() ELSE confirmed_by END,
      confirmed_at = CASE WHEN v_decision = 'COMPLETED' THEN v_changed_at ELSE confirmed_at END
  WHERE id = v_payment.id AND restaurant_id = v_restaurant_id AND status = 'PENDING';

  IF v_decision = 'COMPLETED' THEN
    UPDATE public.orders
    SET status = 'PAID', updated_at = v_changed_at
    WHERE id = v_payment.order_id AND restaurant_id = v_restaurant_id;
  END IF;

  INSERT INTO public.payment_audit_events (restaurant_id, payment_id, order_id, actor_user_id, action, metadata)
  VALUES (
    v_restaurant_id,
    v_payment.id,
    v_payment.order_id,
    auth.uid(),
    CASE WHEN v_decision = 'COMPLETED' THEN 'PAYMENT_CONFIRMED' ELSE 'PAYMENT_REJECTED' END,
    jsonb_build_object(
      'previous_status', 'PENDING',
      'new_status', v_decision,
      'note', nullif(trim(p_note), ''),
      'changed_at', v_changed_at
    )
  );

  RETURN jsonb_build_object(
    'paymentId', v_payment.id,
    'orderId', v_payment.order_id,
    'status', v_decision,
    'message', CASE
      WHEN v_decision = 'COMPLETED' THEN 'Payment confirmed successfully.'
      ELSE 'Payment rejected and placed in failed status.'
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_pending_payment(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.resolve_pending_payment(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_pending_payment(
  p_order_id uuid,
  p_method text,
  p_account_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_restaurant_id uuid;
  v_method text := upper(trim(coalesce(p_method, '')));
  v_enabled_methods text[];
  v_order record;
  v_account record;
  v_existing_payment record;
  v_payment_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '42501';
  END IF;

  SELECT restaurant_id INTO v_restaurant_id
  FROM public.restaurant_users
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND OR NOT public.has_restaurant_role(v_restaurant_id, array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']) THEN
    RAISE EXCEPTION 'Active restaurant service access is required.' USING ERRCODE = '42501';
  END IF;

  IF v_method NOT IN ('TELEBIRR', 'BANK_TRANSFER') THEN
    RAISE EXCEPTION 'Only configured Telebirr or bank transfer can be pending.' USING ERRCODE = '22023';
  END IF;

  SELECT enabled_payment_methods INTO v_enabled_methods
  FROM public.restaurant_settings
  WHERE restaurant_id = v_restaurant_id;
  IF NOT FOUND THEN v_enabled_methods := array['CASH']; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM unnest(v_enabled_methods) AS enabled(method_name)
    WHERE upper(trim(enabled.method_name)) = v_method
       OR (v_method = 'BANK_TRANSFER' AND upper(trim(enabled.method_name)) = 'CBE')
  ) THEN
    RAISE EXCEPTION 'This payment method is not enabled.' USING ERRCODE = '23514';
  END IF;

  SELECT id, total, status INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND restaurant_id = v_restaurant_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found in this restaurant.' USING ERRCODE = 'P0002'; END IF;
  IF v_order.status IN ('CANCELLED', 'PAID') OR v_order.total <= 0 THEN
    RAISE EXCEPTION 'This order cannot accept a pending payment.' USING ERRCODE = '23514';
  END IF;

  SELECT id, account_number, type, verify_et_provider
    INTO v_account
  FROM public.payment_accounts
  WHERE restaurant_id = v_restaurant_id
    AND type = v_method
    AND is_active = true
    AND (p_account_id IS NULL OR id = p_account_id)
    AND nullif(trim(account_number), '') IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active payment account is configured.' USING ERRCODE = '23514'; END IF;
  IF v_method = 'TELEBIRR' AND v_account.verify_et_provider IS DISTINCT FROM 'telebirr' THEN
    RAISE EXCEPTION 'Telebirr account provider identity is not configured.' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payments
    WHERE restaurant_id = v_restaurant_id AND order_id = p_order_id AND status = 'COMPLETED'
  ) THEN
    RAISE EXCEPTION 'This order has already been paid.' USING ERRCODE = '23514';
  END IF;

  SELECT id, amount, verify_et_provider, method
    INTO v_existing_payment
  FROM public.payments
  WHERE restaurant_id = v_restaurant_id
    AND order_id = p_order_id
    AND status = 'PENDING'
  LIMIT 1;
  IF FOUND THEN
    IF v_existing_payment.method <> v_method THEN
      RAISE EXCEPTION 'An active payment already exists for this order.' USING ERRCODE = '23514';
    END IF;
    RETURN jsonb_build_object(
      'payment_id', v_existing_payment.id,
      'amount', v_existing_payment.amount,
      'created', false,
      'verify_et_provider', v_existing_payment.verify_et_provider
    );
  END IF;

  INSERT INTO public.payments (
    restaurant_id, order_id, amount, method, status, received_by, verify_et_provider
  ) VALUES (
    v_restaurant_id, p_order_id, v_order.total, v_method, 'PENDING', auth.uid(), v_account.verify_et_provider
  ) RETURNING id INTO v_payment_id;

  INSERT INTO public.payment_audit_events (
    restaurant_id, payment_id, order_id, actor_user_id, action, metadata
  ) VALUES (
    v_restaurant_id,
    v_payment_id,
    p_order_id,
    auth.uid(),
    'PAYMENT_CREATED',
    jsonb_build_object(
      'method', v_method,
      'account_id', v_account.id,
      'verify_et_provider', v_account.verify_et_provider,
      'status', 'PENDING'
    )
  );

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'amount', v_order.total,
    'created', true,
    'verify_et_provider', v_account.verify_et_provider
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_pending_payment(uuid, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_pending_payment(uuid, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_completed_payment(
  p_order_id uuid,
  p_amount numeric,
  p_method text,
  p_reference_number text,
  p_cash_received numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
  IF EXISTS (SELECT 1 FROM public.payments WHERE restaurant_id = v_restaurant_id AND order_id = p_order_id AND status = 'PENDING') THEN
    RAISE EXCEPTION 'An active payment already exists for this order.' USING ERRCODE = '23514';
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