DO $$
DECLARE
  v_recipe record;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.inventory_items
    WHERE unit NOT IN ('kg', 'g', 'L', 'ml', 'pcs', 'box')
  ) THEN
    RAISE EXCEPTION 'Inventory unit integrity preflight failed: unsupported inventory units exist.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.stock_movements sm
    JOIN public.inventory_items i
      ON i.id = sm.item_id AND i.restaurant_id = sm.restaurant_id
    WHERE sm.unit IS DISTINCT FROM i.unit
  ) THEN
    RAISE EXCEPTION 'Inventory unit integrity preflight failed: stock movement units differ from current inventory base units; reconcile without deleting history.';
  END IF;

  FOR v_recipe IN
    SELECT quantity_required, unit, inventory_item_id, restaurant_id
    FROM public.menu_item_inventory_items
  LOOP
    BEGIN
      PERFORM public.convert_recipe_stock_quantity(
        v_recipe.quantity_required,
        v_recipe.unit,
        (SELECT unit FROM public.inventory_items
         WHERE id = v_recipe.inventory_item_id AND restaurant_id = v_recipe.restaurant_id)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Inventory unit integrity preflight failed: an existing recipe is incompatible with its inventory item unit.';
    END;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.guard_inventory_item_unit_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.unit NOT IN ('kg', 'g', 'L', 'ml', 'pcs', 'box') THEN
    RAISE EXCEPTION 'Choose a supported inventory unit.' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.unit IS DISTINCT FROM OLD.unit THEN
     IF OLD.current_quantity <> 0
       OR OLD.minimum_stock_level <> 0
       OR OLD.cost_price <> 0
       OR EXISTS (
         SELECT 1 FROM public.stock_movements
         WHERE restaurant_id = OLD.restaurant_id AND item_id = OLD.id
       )
       OR EXISTS (
         SELECT 1 FROM public.menu_item_inventory_items
         WHERE restaurant_id = OLD.restaurant_id AND inventory_item_id = OLD.id
       ) THEN
      RAISE EXCEPTION 'Inventory item unit cannot be changed after stock, movement, recipe use, or unit-based settings.' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_inventory_item_unit_change() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS inventory_items_unit_integrity ON public.inventory_items;
CREATE TRIGGER inventory_items_unit_integrity
  BEFORE INSERT OR UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_inventory_item_unit_change();

CREATE OR REPLACE FUNCTION public.validate_menu_inventory_recipe()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_menu_station text;
  v_inventory_station text;
  v_inventory_unit text;
BEGIN
  SELECT station INTO v_menu_station
  FROM public.menu_items
  WHERE id = NEW.menu_item_id AND restaurant_id = NEW.restaurant_id;

  SELECT station, unit INTO v_inventory_station, v_inventory_unit
  FROM public.inventory_items
  WHERE id = NEW.inventory_item_id AND restaurant_id = NEW.restaurant_id
  FOR UPDATE;

  IF v_menu_station IS NULL OR v_inventory_station IS NULL THEN
    RAISE EXCEPTION 'Recipe references must belong to the same restaurant.' USING ERRCODE = '23503';
  END IF;
  IF v_menu_station <> v_inventory_station THEN
    RAISE EXCEPTION 'Recipe station must match the menu item station.' USING ERRCODE = '23514';
  END IF;

  PERFORM public.convert_recipe_stock_quantity(NEW.quantity_required, NEW.unit, v_inventory_unit);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_stock_movement(
  p_restaurant_id uuid,
  p_item_id uuid,
  p_movement_type text,
  p_quantity_delta numeric,
  p_unit text,
  p_unit_cost numeric,
  p_reason text,
  p_performed_by uuid,
  p_related_order_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item record;
  v_previous_quantity numeric(12,3);
  v_new_quantity numeric(12,3);
  v_stock_movement_id uuid;
  v_input_unit text;
  v_quantity_delta numeric(12,3);
  v_unit_cost numeric(12,2);
BEGIN
  IF p_restaurant_id IS NULL OR p_item_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant and item are required.';
  END IF;
  IF p_performed_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'The authenticated user must perform the stock movement.';
  END IF;
  IF p_movement_type NOT IN ('ADD_STOCK', 'ADJUSTMENT') OR p_quantity_delta IS NULL OR p_quantity_delta = 0 THEN
    RAISE EXCEPTION 'Use a non-zero stock addition or adjustment.';
  END IF;
  IF NOT public.has_restaurant_role(p_restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']) THEN
    RAISE EXCEPTION 'Only Admin, Owner, or Manager can update inventory.';
  END IF;

  SELECT * INTO v_item
  FROM public.inventory_items
  WHERE id = p_item_id AND restaurant_id = p_restaurant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found in this restaurant.';
  END IF;

  IF p_movement_type = 'ADD_STOCK' AND p_quantity_delta < 0 THEN
    RAISE EXCEPTION 'Stock additions must be positive.';
  END IF;

  v_input_unit := coalesce(nullif(trim(p_unit), ''), v_item.unit);
  v_quantity_delta := public.convert_recipe_stock_quantity(
    abs(p_quantity_delta), v_input_unit, v_item.unit
  ) * CASE WHEN p_quantity_delta < 0 THEN -1 ELSE 1 END;
  v_unit_cost := CASE
    WHEN p_unit_cost IS NULL THEN NULL
    ELSE p_unit_cost * abs(p_quantity_delta) / abs(v_quantity_delta)
  END;

  v_previous_quantity := v_item.current_quantity;
  v_new_quantity := v_previous_quantity + v_quantity_delta;
  IF v_new_quantity < 0 THEN
    RAISE EXCEPTION 'This stock movement would make the inventory item negative.';
  END IF;

  UPDATE public.inventory_items
  SET current_quantity = v_new_quantity, updated_at = now()
  WHERE id = p_item_id AND restaurant_id = p_restaurant_id;

  INSERT INTO public.stock_movements (
    restaurant_id, item_id, movement_type, quantity_delta, unit, unit_cost,
    reason, previous_quantity, new_quantity, performed_by_user_id, related_order_id
  ) VALUES (
    p_restaurant_id, p_item_id, p_movement_type, v_quantity_delta, v_item.unit, v_unit_cost,
    p_reason, v_previous_quantity, v_new_quantity, auth.uid(), p_related_order_id
  ) RETURNING id INTO v_stock_movement_id;

  INSERT INTO public.inventory_audit_logs (
    restaurant_id, item_id, action, performed_by_user_id,
    previous_quantity, new_quantity, note
  ) VALUES (
    p_restaurant_id, p_item_id, p_movement_type, auth.uid(),
    v_previous_quantity, v_new_quantity, coalesce(p_reason, 'Stock movement recorded')
  );

  RETURN v_stock_movement_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_stock_movement(uuid, uuid, text, numeric, text, numeric, text, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_stock_movement(uuid, uuid, text, numeric, text, numeric, text, uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';