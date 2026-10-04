-- Stop before changing schema if existing tenant-owned references are inconsistent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.menu_items m JOIN public.categories c ON c.id = m.category_id WHERE m.category_id IS NOT NULL AND m.restaurant_id <> c.restaurant_id) THEN RAISE EXCEPTION 'Tenant preflight failed: menu_items.category_id'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders o JOIN public.tables t ON t.id = o.table_id WHERE o.table_id IS NOT NULL AND o.restaurant_id <> t.restaurant_id) THEN RAISE EXCEPTION 'Tenant preflight failed: orders.table_id'; END IF;
  IF EXISTS (SELECT 1 FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id WHERE oi.restaurant_id <> o.restaurant_id) THEN RAISE EXCEPTION 'Tenant preflight failed: order_items.order_id'; END IF;
  IF EXISTS (SELECT 1 FROM public.order_items oi JOIN public.menu_items m ON m.id = oi.menu_item_id WHERE oi.menu_item_id IS NOT NULL AND oi.restaurant_id <> m.restaurant_id) THEN RAISE EXCEPTION 'Tenant preflight failed: order_items.menu_item_id'; END IF;
  IF EXISTS (SELECT 1 FROM public.kitchen_orders ko JOIN public.orders o ON o.id = ko.order_id WHERE ko.restaurant_id <> o.restaurant_id) THEN RAISE EXCEPTION 'Tenant preflight failed: kitchen_orders.order_id'; END IF;
  IF EXISTS (SELECT 1 FROM public.payments p JOIN public.orders o ON o.id = p.order_id WHERE p.restaurant_id <> o.restaurant_id) THEN RAISE EXCEPTION 'Tenant preflight failed: payments.order_id'; END IF;
  IF EXISTS (SELECT 1 FROM public.payment_audit_events e JOIN public.payments p ON p.id = e.payment_id WHERE e.restaurant_id <> p.restaurant_id OR (e.order_id IS NOT NULL AND e.order_id <> p.order_id)) THEN RAISE EXCEPTION 'Tenant preflight failed: payment_audit_events references'; END IF;
  IF EXISTS (SELECT 1 FROM public.inventory_items i JOIN public.inventory_categories c ON c.id = i.category_id WHERE i.category_id IS NOT NULL AND i.restaurant_id <> c.restaurant_id) THEN RAISE EXCEPTION 'Tenant preflight failed: inventory_items.category_id'; END IF;
  IF EXISTS (SELECT 1 FROM public.inventory_items i JOIN public.suppliers s ON s.id = i.supplier_id WHERE i.supplier_id IS NOT NULL AND i.restaurant_id <> s.restaurant_id) THEN RAISE EXCEPTION 'Tenant preflight failed: inventory_items.supplier_id'; END IF;
  IF EXISTS (SELECT 1 FROM public.stock_movements sm JOIN public.inventory_items i ON i.id = sm.item_id WHERE sm.restaurant_id <> i.restaurant_id) THEN RAISE EXCEPTION 'Tenant preflight failed: stock_movements.item_id'; END IF;
  IF EXISTS (SELECT 1 FROM public.stock_requests sr JOIN public.inventory_items i ON i.id = sr.item_id WHERE sr.item_id IS NOT NULL AND sr.restaurant_id <> i.restaurant_id) THEN RAISE EXCEPTION 'Tenant preflight failed: stock_requests.item_id'; END IF;
  IF EXISTS (SELECT 1 FROM public.inventory_audit_logs a JOIN public.inventory_items i ON i.id = a.item_id WHERE a.restaurant_id <> i.restaurant_id) THEN RAISE EXCEPTION 'Tenant preflight failed: inventory_audit_logs.item_id'; END IF;
  IF EXISTS (SELECT 1 FROM public.menu_item_inventory_items r JOIN public.menu_items m ON m.id = r.menu_item_id WHERE r.restaurant_id <> m.restaurant_id)
     OR EXISTS (SELECT 1 FROM public.menu_item_inventory_items r JOIN public.inventory_items i ON i.id = r.inventory_item_id WHERE r.restaurant_id <> i.restaurant_id) THEN RAISE EXCEPTION 'Tenant preflight failed: menu_item_inventory_items references'; END IF;
END;
$$;

-- Cross-table tenant references are checked on every future direct/API write.
CREATE OR REPLACE FUNCTION public.validate_tenant_references()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME = 'menu_items' AND NEW.category_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = NEW.category_id AND c.restaurant_id = NEW.restaurant_id) THEN
    RAISE EXCEPTION 'Category must belong to this restaurant.' USING ERRCODE = '23503';
  ELSIF TG_TABLE_NAME = 'orders' THEN
    IF NEW.table_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tables t WHERE t.id = NEW.table_id AND t.restaurant_id = NEW.restaurant_id) THEN
      RAISE EXCEPTION 'Table must belong to this restaurant.' USING ERRCODE = '23503';
    END IF;
    IF NEW.created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.restaurant_users ru WHERE ru.restaurant_id = NEW.restaurant_id AND ru.user_id = NEW.created_by) THEN
      RAISE EXCEPTION 'Order creator must belong to this restaurant.' USING ERRCODE = '23503';
    END IF;
  ELSIF TG_TABLE_NAME = 'order_items' THEN
    IF NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = NEW.order_id AND o.restaurant_id = NEW.restaurant_id) THEN
      RAISE EXCEPTION 'Order item order must belong to this restaurant.' USING ERRCODE = '23503';
    END IF;
    IF NEW.menu_item_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.menu_items m WHERE m.id = NEW.menu_item_id AND m.restaurant_id = NEW.restaurant_id) THEN
      RAISE EXCEPTION 'Order item menu item must belong to this restaurant.' USING ERRCODE = '23503';
    END IF;
  ELSIF TG_TABLE_NAME = 'kitchen_orders' THEN
    IF NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = NEW.order_id AND o.restaurant_id = NEW.restaurant_id) THEN
      RAISE EXCEPTION 'Station order must belong to this restaurant.' USING ERRCODE = '23503';
    END IF;
  ELSIF TG_TABLE_NAME = 'payments' THEN
    IF NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = NEW.order_id AND o.restaurant_id = NEW.restaurant_id) THEN
      RAISE EXCEPTION 'Payment order must belong to this restaurant.' USING ERRCODE = '23503';
    END IF;
  ELSIF TG_TABLE_NAME = 'payment_audit_events' THEN
    IF NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.id = NEW.payment_id AND p.restaurant_id = NEW.restaurant_id) THEN
      RAISE EXCEPTION 'Payment audit payment must belong to this restaurant.' USING ERRCODE = '23503';
    END IF;
    IF NEW.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = NEW.order_id AND o.restaurant_id = NEW.restaurant_id) THEN
      RAISE EXCEPTION 'Payment audit order must belong to this restaurant.' USING ERRCODE = '23503';
    END IF;
  ELSIF TG_TABLE_NAME = 'inventory_items' THEN
    IF NEW.category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.inventory_categories c WHERE c.id = NEW.category_id AND c.restaurant_id = NEW.restaurant_id) THEN
      RAISE EXCEPTION 'Inventory category must belong to this restaurant.' USING ERRCODE = '23503';
    END IF;
    IF NEW.supplier_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = NEW.supplier_id AND s.restaurant_id = NEW.restaurant_id) THEN
      RAISE EXCEPTION 'Inventory supplier must belong to this restaurant.' USING ERRCODE = '23503';
    END IF;
  ELSIF TG_TABLE_NAME = 'stock_movements' THEN
    IF NOT EXISTS (SELECT 1 FROM public.inventory_items i WHERE i.id = NEW.item_id AND i.restaurant_id = NEW.restaurant_id) THEN
      RAISE EXCEPTION 'Stock movement item must belong to this restaurant.' USING ERRCODE = '23503';
    END IF;
    IF NEW.related_order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = NEW.related_order_id AND o.restaurant_id = NEW.restaurant_id) THEN
      RAISE EXCEPTION 'Stock movement order must belong to this restaurant.' USING ERRCODE = '23503';
    END IF;
  ELSIF TG_TABLE_NAME = 'stock_requests' THEN
    IF NEW.item_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.inventory_items i WHERE i.id = NEW.item_id AND i.restaurant_id = NEW.restaurant_id) THEN
      RAISE EXCEPTION 'Stock request item must belong to this restaurant.' USING ERRCODE = '23503';
    END IF;
  ELSIF TG_TABLE_NAME = 'inventory_audit_logs' THEN
    IF NOT EXISTS (SELECT 1 FROM public.inventory_items i WHERE i.id = NEW.item_id AND i.restaurant_id = NEW.restaurant_id) THEN
      RAISE EXCEPTION 'Inventory audit item must belong to this restaurant.' USING ERRCODE = '23503';
    END IF;
  ELSIF TG_TABLE_NAME = 'menu_item_inventory_items' THEN
    IF NOT EXISTS (SELECT 1 FROM public.menu_items m WHERE m.id = NEW.menu_item_id AND m.restaurant_id = NEW.restaurant_id)
       OR NOT EXISTS (SELECT 1 FROM public.inventory_items i WHERE i.id = NEW.inventory_item_id AND i.restaurant_id = NEW.restaurant_id) THEN
      RAISE EXCEPTION 'Recipe references must belong to this restaurant.' USING ERRCODE = '23503';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_tenant_references() FROM public, anon, authenticated;

CREATE TRIGGER validate_menu_item_tenant_reference BEFORE INSERT OR UPDATE OF restaurant_id, category_id ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references();
CREATE TRIGGER validate_order_tenant_references BEFORE INSERT OR UPDATE OF restaurant_id, table_id, created_by ON public.orders FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references();
CREATE TRIGGER validate_order_item_tenant_references BEFORE INSERT OR UPDATE OF restaurant_id, order_id, menu_item_id ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references();
CREATE TRIGGER validate_kitchen_order_tenant_reference BEFORE INSERT OR UPDATE OF restaurant_id, order_id ON public.kitchen_orders FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references();
CREATE TRIGGER validate_payment_tenant_reference BEFORE INSERT OR UPDATE OF restaurant_id, order_id ON public.payments FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references();
CREATE TRIGGER validate_payment_audit_tenant_references BEFORE INSERT OR UPDATE OF restaurant_id, payment_id, order_id ON public.payment_audit_events FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references();
CREATE TRIGGER validate_inventory_item_tenant_references BEFORE INSERT OR UPDATE OF restaurant_id, category_id, supplier_id ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references();
CREATE TRIGGER validate_stock_movement_tenant_references BEFORE INSERT OR UPDATE OF restaurant_id, item_id, related_order_id ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references();
CREATE TRIGGER validate_stock_request_tenant_references BEFORE INSERT OR UPDATE OF restaurant_id, item_id ON public.stock_requests FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references();
CREATE TRIGGER validate_inventory_audit_tenant_reference BEFORE INSERT OR UPDATE OF restaurant_id, item_id ON public.inventory_audit_logs FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references();
CREATE TRIGGER validate_inventory_recipe_tenant_references BEFORE INSERT OR UPDATE OF restaurant_id, menu_item_id, inventory_item_id ON public.menu_item_inventory_items FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references();

-- Direct REST clients cannot change order/payment status or mutate immutable ledgers.
REVOKE UPDATE ON public.orders FROM public, anon, authenticated;
REVOKE UPDATE, DELETE ON public.order_items FROM public, anon, authenticated;
GRANT INSERT ON public.order_items TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM public, anon, authenticated;
GRANT SELECT ON public.payments TO authenticated;
DROP POLICY IF EXISTS "service roles can insert payments" ON public.payments;
DROP POLICY IF EXISTS "service roles can update payments" ON public.payments;
REVOKE INSERT, UPDATE, DELETE ON public.payment_audit_events FROM public, anon, authenticated;
GRANT SELECT ON public.payment_audit_events TO authenticated;
DROP POLICY IF EXISTS "active restaurant staff can insert payment audit events" ON public.payment_audit_events;
DROP POLICY IF EXISTS "restaurant staff can insert payment audit events" ON public.payment_audit_events;

REVOKE INSERT, UPDATE, DELETE ON public.stock_movements FROM public, anon, authenticated;
GRANT SELECT ON public.stock_movements TO authenticated;
DROP POLICY IF EXISTS "restaurant staff can add stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "managers can modify stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "managers can delete stock movements" ON public.stock_movements;
REVOKE INSERT, UPDATE, DELETE ON public.inventory_audit_logs FROM public, anon, authenticated;
GRANT SELECT ON public.inventory_audit_logs TO authenticated;
DROP POLICY IF EXISTS "staff can create inventory audit logs through protected functions" ON public.inventory_audit_logs;
DROP POLICY IF EXISTS "managers can update inventory audit logs" ON public.inventory_audit_logs;

REVOKE INSERT, UPDATE ON public.inventory_items FROM public, anon, authenticated;
GRANT INSERT (restaurant_id, category_id, supplier_id, name, sku, description, unit, minimum_stock_level, cost_price, station, is_active)
  ON public.inventory_items TO authenticated;
GRANT UPDATE (category_id, supplier_id, name, sku, description, unit, minimum_stock_level, cost_price, station, is_active, updated_at)
  ON public.inventory_items TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_order_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status <> 'NEW' THEN RAISE EXCEPTION 'New orders must start in NEW status.' USING ERRCODE = '23514'; END IF;
  IF auth.uid() IS NOT NULL AND (NEW.created_by IS DISTINCT FROM auth.uid() OR NOT public.has_restaurant_role(NEW.restaurant_id, array['ADMIN', 'OWNER', 'MANAGER', 'SERVER'])) THEN
    RAISE EXCEPTION 'An authorized restaurant service user must create the order.' USING ERRCODE = '42501';
  END IF;
  NEW.subtotal := 0;
  NEW.total := 0;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_order_insert() FROM public, anon, authenticated;
CREATE TRIGGER validate_order_insert BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.validate_order_insert();

CREATE OR REPLACE FUNCTION public.validate_order_item_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_order_status text;
  v_menu_price numeric(12,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_restaurant_role(NEW.restaurant_id, array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']) THEN
    RAISE EXCEPTION 'An authorized restaurant service user must add order items.' USING ERRCODE = '42501';
  END IF;
  IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN RAISE EXCEPTION 'Order quantity must be positive.' USING ERRCODE = '23514'; END IF;
  SELECT status INTO v_order_status FROM public.orders WHERE id = NEW.order_id AND restaurant_id = NEW.restaurant_id FOR UPDATE;
  IF NOT FOUND OR v_order_status <> 'NEW' THEN RAISE EXCEPTION 'Order item must belong to a NEW order in this restaurant.' USING ERRCODE = '23503'; END IF;
  SELECT price INTO v_menu_price FROM public.menu_items WHERE id = NEW.menu_item_id AND restaurant_id = NEW.restaurant_id AND is_available = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Available menu item must belong to this restaurant.' USING ERRCODE = '23503'; END IF;
  NEW.unit_price := v_menu_price;
  NEW.subtotal := v_menu_price * NEW.quantity;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_order_item_insert() FROM public, anon, authenticated;
CREATE TRIGGER validate_order_item_insert BEFORE INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.validate_order_item_insert();

CREATE OR REPLACE FUNCTION public.recalculate_order_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_total numeric(12,2);
BEGIN
  SELECT coalesce(sum(subtotal), 0) INTO v_total FROM public.order_items WHERE order_id = NEW.order_id AND restaurant_id = NEW.restaurant_id;
  UPDATE public.orders SET subtotal = v_total, total = v_total, updated_at = now()
  WHERE id = NEW.order_id AND restaurant_id = NEW.restaurant_id AND status = 'NEW';
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.recalculate_order_total() FROM public, anon, authenticated;
CREATE TRIGGER recalculate_order_total AFTER INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.recalculate_order_total();

CREATE OR REPLACE FUNCTION public.audit_inventory_item_creation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'An authenticated user must create inventory items.' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.inventory_audit_logs (restaurant_id, item_id, action, performed_by_user_id, previous_quantity, new_quantity, note)
  VALUES (NEW.restaurant_id, NEW.id, 'ITEM_CREATED', auth.uid(), 0, NEW.current_quantity, 'Inventory item created');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_inventory_item_creation() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS audit_inventory_item_creation ON public.inventory_items;
CREATE TRIGGER audit_inventory_item_creation AFTER INSERT ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.audit_inventory_item_creation();

CREATE OR REPLACE FUNCTION public.record_low_stock_alert(p_restaurant_id uuid, p_item_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_item record;
  v_last_alert timestamptz;
  v_last_movement timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_restaurant_role(p_restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']) THEN
    RAISE EXCEPTION 'Management access to this active restaurant is required.' USING ERRCODE = '42501';
  END IF;
  SELECT id, name, current_quantity, minimum_stock_level INTO v_item
  FROM public.inventory_items WHERE id = p_item_id AND restaurant_id = p_restaurant_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item not found.' USING ERRCODE = 'P0002'; END IF;
  IF v_item.current_quantity > v_item.minimum_stock_level THEN RETURN false; END IF;

  SELECT created_at INTO v_last_alert FROM public.inventory_audit_logs
  WHERE restaurant_id = p_restaurant_id AND item_id = p_item_id AND action = 'LOW_STOCK_ALERT'
  ORDER BY created_at DESC LIMIT 1;
  SELECT created_at INTO v_last_movement FROM public.stock_movements
  WHERE restaurant_id = p_restaurant_id AND item_id = p_item_id
  ORDER BY created_at DESC LIMIT 1;
  IF v_last_alert IS NOT NULL AND (v_last_movement IS NULL OR v_last_alert >= v_last_movement) THEN RETURN false; END IF;

  INSERT INTO public.inventory_audit_logs (restaurant_id, item_id, action, performed_by_user_id, previous_quantity, new_quantity, note)
  VALUES (p_restaurant_id, p_item_id, 'LOW_STOCK_ALERT', auth.uid(), v_item.current_quantity, v_item.current_quantity, format('Low stock alert triggered for %s', v_item.name));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.record_low_stock_alert(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_low_stock_alert(uuid, uuid) TO authenticated;

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

CREATE OR REPLACE FUNCTION public.resolve_pending_payment(p_payment_id uuid, p_decision text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_restaurant_id uuid;
  v_payment record;
  v_item_total numeric(12,2);
  v_item_count bigint;
  v_decision text := upper(trim(coalesce(p_decision, '')));
  v_changed_at timestamptz := now();
  v_reference text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '42501'; END IF;
  SELECT restaurant_id INTO v_restaurant_id FROM public.restaurant_users WHERE user_id = auth.uid() ORDER BY created_at ASC LIMIT 1;
  IF NOT FOUND OR NOT public.has_restaurant_role(v_restaurant_id, array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']) THEN RAISE EXCEPTION 'Active restaurant service access is required.' USING ERRCODE = '42501'; END IF;
  IF v_decision NOT IN ('COMPLETED', 'FAILED') THEN RAISE EXCEPTION 'Payment decision must be COMPLETED or FAILED.' USING ERRCODE = '22023'; END IF;

  SELECT p.id, p.restaurant_id, p.order_id, p.amount, p.method, p.status, p.reference_number,
         o.total AS order_total, o.status AS order_status
  INTO v_payment
  FROM public.payments p JOIN public.orders o ON o.id = p.order_id AND o.restaurant_id = p.restaurant_id
  WHERE p.id = p_payment_id AND p.restaurant_id = v_restaurant_id
  FOR UPDATE OF p, o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment was not found in this restaurant.' USING ERRCODE = 'P0002'; END IF;
  IF v_payment.status <> 'PENDING' OR v_payment.amount <= 0 THEN RAISE EXCEPTION 'Payment is not pending verification.' USING ERRCODE = '23514'; END IF;

  IF v_decision = 'COMPLETED' THEN
    IF v_payment.order_status IN ('CANCELLED', 'PAID') OR v_payment.amount <> v_payment.order_total THEN
      RAISE EXCEPTION 'Pending payment no longer matches a payable order.' USING ERRCODE = '23514';
    END IF;
    SELECT count(*), coalesce(sum(subtotal), 0) INTO v_item_count, v_item_total FROM public.order_items
    WHERE order_id = v_payment.order_id AND restaurant_id = v_restaurant_id;
    IF v_item_count = 0 OR v_item_total <> v_payment.order_total THEN RAISE EXCEPTION 'Order lines do not match the order total.' USING ERRCODE = '23514'; END IF;
  END IF;

  v_reference := coalesce(nullif(trim(p_note), ''), v_payment.reference_number);
  UPDATE public.payments SET status = v_decision, reference_number = v_reference,
    confirmed_by = CASE WHEN v_decision = 'COMPLETED' THEN auth.uid() ELSE confirmed_by END,
    confirmed_at = CASE WHEN v_decision = 'COMPLETED' THEN v_changed_at ELSE confirmed_at END
  WHERE id = v_payment.id AND restaurant_id = v_restaurant_id AND status = 'PENDING';
  IF v_decision = 'COMPLETED' THEN
    UPDATE public.orders SET status = 'PAID', updated_at = v_changed_at
    WHERE id = v_payment.order_id AND restaurant_id = v_restaurant_id;
  END IF;
  INSERT INTO public.payment_audit_events (restaurant_id, payment_id, order_id, actor_user_id, action, metadata)
  VALUES (v_restaurant_id, v_payment.id, v_payment.order_id, auth.uid(),
    CASE WHEN v_decision = 'COMPLETED' THEN 'PAYMENT_CONFIRMED' ELSE 'PAYMENT_REJECTED' END,
    jsonb_build_object('previous_status', 'PENDING', 'new_status', v_decision, 'note', nullif(trim(p_note), ''), 'changed_at', v_changed_at));
  RETURN jsonb_build_object('paymentId', v_payment.id, 'orderId', v_payment.order_id, 'status', v_decision,
    'message', CASE WHEN v_decision = 'COMPLETED' THEN 'Payment confirmed successfully.' ELSE 'Payment rejected and placed in failed status.' END);
END;
$$;

REVOKE ALL ON FUNCTION public.record_completed_payment(uuid, numeric, text, text, numeric) FROM public, anon;
REVOKE ALL ON FUNCTION public.create_pending_payment(uuid, text, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.resolve_pending_payment(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_completed_payment(uuid, numeric, text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_pending_payment(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_pending_payment(uuid, text, text) TO authenticated;

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

CREATE OR REPLACE FUNCTION public.resolve_pending_payment(p_payment_id uuid, p_decision text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_restaurant_id uuid;
  v_payment record;
  v_item_total numeric(12,2);
  v_item_count bigint;
  v_decision text := upper(trim(coalesce(p_decision, '')));
  v_changed_at timestamptz := now();
  v_reference text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '42501'; END IF;
  SELECT restaurant_id INTO v_restaurant_id FROM public.restaurant_users WHERE user_id = auth.uid() ORDER BY created_at ASC LIMIT 1;
  IF NOT FOUND OR NOT public.has_restaurant_role(v_restaurant_id, array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']) THEN RAISE EXCEPTION 'Active restaurant service access is required.' USING ERRCODE = '42501'; END IF;
  IF v_decision NOT IN ('COMPLETED', 'FAILED') THEN RAISE EXCEPTION 'Payment decision must be COMPLETED or FAILED.' USING ERRCODE = '22023'; END IF;

  SELECT p.id, p.restaurant_id, p.order_id, p.amount, p.method, p.status, p.reference_number,
         o.total AS order_total, o.status AS order_status
  INTO v_payment
  FROM public.payments p JOIN public.orders o ON o.id = p.order_id AND o.restaurant_id = p.restaurant_id
  WHERE p.id = p_payment_id AND p.restaurant_id = v_restaurant_id
  FOR UPDATE OF p, o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment was not found in this restaurant.' USING ERRCODE = 'P0002'; END IF;
  IF v_payment.status <> 'PENDING' OR v_payment.amount <= 0 THEN RAISE EXCEPTION 'Payment is not pending verification.' USING ERRCODE = '23514'; END IF;

  IF v_decision = 'COMPLETED' THEN
    IF v_payment.order_status IN ('CANCELLED', 'PAID') OR v_payment.amount <> v_payment.order_total THEN
      RAISE EXCEPTION 'Pending payment no longer matches a payable order.' USING ERRCODE = '23514';
    END IF;
    SELECT count(*), coalesce(sum(subtotal), 0) INTO v_item_count, v_item_total FROM public.order_items
    WHERE order_id = v_payment.order_id AND restaurant_id = v_restaurant_id;
    IF v_item_count = 0 OR v_item_total <> v_payment.order_total THEN RAISE EXCEPTION 'Order lines do not match the order total.' USING ERRCODE = '23514'; END IF;
  END IF;

  v_reference := coalesce(nullif(trim(p_note), ''), v_payment.reference_number);
  UPDATE public.payments SET status = v_decision, reference_number = v_reference,
    confirmed_by = CASE WHEN v_decision = 'COMPLETED' THEN auth.uid() ELSE confirmed_by END,
    confirmed_at = CASE WHEN v_decision = 'COMPLETED' THEN v_changed_at ELSE confirmed_at END
  WHERE id = v_payment.id AND restaurant_id = v_restaurant_id AND status = 'PENDING';
  IF v_decision = 'COMPLETED' THEN
    UPDATE public.orders SET status = 'PAID', updated_at = v_changed_at
    WHERE id = v_payment.order_id AND restaurant_id = v_restaurant_id;
  END IF;
  INSERT INTO public.payment_audit_events (restaurant_id, payment_id, order_id, actor_user_id, action, metadata)
  VALUES (v_restaurant_id, v_payment.id, v_payment.order_id, auth.uid(),
    CASE WHEN v_decision = 'COMPLETED' THEN 'PAYMENT_CONFIRMED' ELSE 'PAYMENT_REJECTED' END,
    jsonb_build_object('previous_status', 'PENDING', 'new_status', v_decision, 'note', nullif(trim(p_note), ''), 'changed_at', v_changed_at));
  RETURN jsonb_build_object('paymentId', v_payment.id, 'orderId', v_payment.order_id, 'status', v_decision,
    'message', CASE WHEN v_decision = 'COMPLETED' THEN 'Payment confirmed successfully.' ELSE 'Payment rejected and placed in failed status.' END);
END;
$$;

REVOKE ALL ON FUNCTION public.record_completed_payment(uuid, numeric, text, text, numeric) FROM public, anon;
REVOKE ALL ON FUNCTION public.create_pending_payment(uuid, text, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.resolve_pending_payment(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_completed_payment(uuid, numeric, text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_pending_payment(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_pending_payment(uuid, text, text) TO authenticated;