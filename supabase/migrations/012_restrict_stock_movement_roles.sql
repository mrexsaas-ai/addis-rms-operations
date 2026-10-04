-- Restrict the existing stock movement RPC to the final inventory role model.
-- No tables or columns are added; this only hardens the existing function.

create or replace function public.apply_stock_movement(
  p_restaurant_id uuid,
  p_item_id uuid,
  p_movement_type text,
  p_quantity_delta numeric,
  p_unit text,
  p_unit_cost numeric,
  p_reason text,
  p_performed_by uuid,
  p_related_order_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_previous_quantity numeric(12,3);
  v_new_quantity numeric(12,3);
  v_stock_movement_id uuid;
  v_normalized_unit text;
begin
  if p_restaurant_id is null or p_item_id is null then
    raise exception 'Restaurant and item are required.';
  end if;

  if p_movement_type <> 'ADD_STOCK' or p_quantity_delta is null or p_quantity_delta <= 0 then
    raise exception 'Only positive stock additions are supported.';
  end if;

  if not public.has_restaurant_role(p_restaurant_id, array['CHEF', 'BARMAN']) then
    raise exception 'Only Chef and Barman roles can add stock for this restaurant.';
  end if;

  select * into v_item
  from public.inventory_items
  where id = p_item_id and restaurant_id = p_restaurant_id
  for update;

  if not found then
    raise exception 'Inventory item not found in this restaurant.';
  end if;

  v_normalized_unit := coalesce(nullif(trim(p_unit), ''), v_item.unit);
  v_previous_quantity := v_item.current_quantity;
  v_new_quantity := v_previous_quantity + p_quantity_delta;

  update public.inventory_items
  set current_quantity = v_new_quantity, updated_at = now()
  where id = p_item_id and restaurant_id = p_restaurant_id;

  insert into public.stock_movements (
    restaurant_id, item_id, movement_type, quantity_delta, unit, unit_cost,
    reason, previous_quantity, new_quantity, performed_by_user_id, related_order_id
  ) values (
    p_restaurant_id, p_item_id, p_movement_type, p_quantity_delta, v_normalized_unit,
    p_unit_cost, p_reason, v_previous_quantity, v_new_quantity, p_performed_by, p_related_order_id
  ) returning id into v_stock_movement_id;

  insert into public.inventory_audit_logs (
    restaurant_id, item_id, action, performed_by_user_id,
    previous_quantity, new_quantity, note
  ) values (
    p_restaurant_id, p_item_id, p_movement_type, p_performed_by,
    v_previous_quantity, v_new_quantity, coalesce(p_reason, 'Stock movement recorded')
  );

  return v_stock_movement_id;
end;
$$;

revoke execute on function public.apply_stock_movement(uuid, uuid, text, numeric, text, numeric, text, uuid, uuid) from public;
grant execute on function public.apply_stock_movement(uuid, uuid, text, numeric, text, numeric, text, uuid, uuid) to authenticated;