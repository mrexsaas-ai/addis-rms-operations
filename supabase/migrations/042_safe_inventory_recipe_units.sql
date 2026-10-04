create or replace function public.convert_recipe_stock_quantity(
  p_quantity numeric,
  p_recipe_unit text,
  p_inventory_unit text
)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_recipe_unit text := trim(coalesce(p_recipe_unit, ''));
  v_inventory_unit text := trim(coalesce(p_inventory_unit, ''));
  v_recipe_dimension text;
  v_inventory_dimension text;
  v_recipe_factor numeric;
  v_inventory_factor numeric;
  v_converted numeric;
begin
  if p_quantity is null or p_quantity::text = 'NaN' or p_quantity <= 0 then
    raise exception 'Recipe quantity must be a finite value greater than zero.' using errcode = '22023';
  end if;

  if v_recipe_unit not in ('kg', 'g', 'L', 'ml', 'pcs', 'box')
     or v_inventory_unit not in ('kg', 'g', 'L', 'ml', 'pcs', 'box') then
    raise exception 'Recipe and inventory units must use supported units.' using errcode = '22023';
  end if;

  if v_recipe_unit = v_inventory_unit then
    v_converted := p_quantity;
  else
    v_recipe_dimension := case v_recipe_unit
      when 'kg' then 'mass'
      when 'g' then 'mass'
      when 'L' then 'volume'
      when 'ml' then 'volume'
      else v_recipe_unit
    end;
    v_inventory_dimension := case v_inventory_unit
      when 'kg' then 'mass'
      when 'g' then 'mass'
      when 'L' then 'volume'
      when 'ml' then 'volume'
      else v_inventory_unit
    end;

    if v_recipe_dimension <> v_inventory_dimension then
      raise exception 'Recipe unit % is incompatible with inventory unit %.', v_recipe_unit, v_inventory_unit using errcode = '22023';
    end if;

    v_recipe_factor := case v_recipe_unit
      when 'kg' then 1000
      when 'g' then 1
      when 'L' then 1000
      when 'ml' then 1
      else 1
    end;
    v_inventory_factor := case v_inventory_unit
      when 'kg' then 1000
      when 'g' then 1
      when 'L' then 1000
      when 'ml' then 1
      else 1
    end;
    v_converted := p_quantity * v_recipe_factor / v_inventory_factor;
  end if;

  if v_converted::text = 'NaN' or v_converted <= 0 then
    raise exception 'Converted recipe quantity is invalid.' using errcode = '22023';
  end if;
  if v_converted <> round(v_converted, 3) then
    raise exception 'Converted recipe quantity exceeds the inventory precision of three decimal places.' using errcode = '22023';
  end if;

  return round(v_converted, 3);
end;
$$;

revoke all on function public.convert_recipe_stock_quantity(numeric, text, text) from public, anon;
grant execute on function public.convert_recipe_stock_quantity(numeric, text, text) to authenticated, service_role;

create or replace function public.validate_menu_inventory_recipe()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_menu_station text;
  v_inventory_station text;
  v_inventory_unit text;
begin
  select station into v_menu_station
  from public.menu_items
  where id = new.menu_item_id and restaurant_id = new.restaurant_id;

  select station, unit into v_inventory_station, v_inventory_unit
  from public.inventory_items
  where id = new.inventory_item_id and restaurant_id = new.restaurant_id;

  if v_menu_station is null or v_inventory_station is null then
    raise exception 'Recipe references must belong to the same restaurant.' using errcode = '23503';
  end if;
  if v_menu_station <> v_inventory_station then
    raise exception 'Recipe station must match the menu item station.' using errcode = '23514';
  end if;

  perform public.convert_recipe_stock_quantity(new.quantity_required, new.unit, v_inventory_unit);
  return new;
end;
$$;

create or replace function public.complete_station_order(p_kitchen_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order record;
  v_locked_item record;
  v_requirement record;
  v_consumption record;
  v_actor_user_id uuid := auth.uid();
  v_changed_at timestamptz := now();
begin
  select ko.id, ko.restaurant_id, ko.station, ko.status, o.id as order_id
    into v_order
  from public.kitchen_orders ko
  join public.orders o on o.id = ko.order_id and o.restaurant_id = ko.restaurant_id
  where ko.id = p_kitchen_order_id
  for update of ko, o;

  if not found then raise exception 'Station order not found.' using errcode = 'P0002'; end if;
  if v_actor_user_id is null or not public.has_restaurant_role(
    v_order.restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', case when v_order.station = 'KITCHEN' then 'CHEF' else 'BARMAN' end]
  ) then
    raise exception 'You do not have permission to complete this station order.' using errcode = '42501';
  end if;
  if v_order.status = 'COMPLETED' then return true; end if;
  if v_order.status <> 'PREPARING' then
    raise exception 'Only orders being prepared can be completed.' using errcode = '23514';
  end if;

  for v_locked_item in
    select i.id
    from public.inventory_items i
    where i.restaurant_id = v_order.restaurant_id
      and exists (
        select 1
        from public.menu_item_inventory_items r
        join public.order_items oi
          on oi.order_id = v_order.order_id
         and oi.restaurant_id = v_order.restaurant_id
         and oi.menu_item_id = r.menu_item_id
        join public.menu_items m
          on m.id = r.menu_item_id
         and m.restaurant_id = r.restaurant_id
        where r.restaurant_id = v_order.restaurant_id
          and r.inventory_item_id = i.id
          and m.station = v_order.station
      )
    order by i.id
    for update of i
  loop
    null;
  end loop;

  for v_requirement in
    select i.id, i.current_quantity,
           sum(public.convert_recipe_stock_quantity(
             r.quantity_required * oi.quantity,
             r.unit,
             i.unit
           )) as required_quantity
    from public.order_items oi
    join public.menu_items m
      on m.id = oi.menu_item_id
     and m.restaurant_id = oi.restaurant_id
    join public.menu_item_inventory_items r
      on r.menu_item_id = m.id
     and r.restaurant_id = m.restaurant_id
    join public.inventory_items i
      on i.id = r.inventory_item_id
     and i.restaurant_id = r.restaurant_id
    where oi.order_id = v_order.order_id
      and oi.restaurant_id = v_order.restaurant_id
      and m.station = v_order.station
    group by i.id, i.current_quantity
    order by i.id
  loop
    if v_requirement.current_quantity::text = 'NaN'
       or v_requirement.current_quantity < v_requirement.required_quantity then
      raise exception 'Insufficient inventory for item %: requires %, available %.',
        v_requirement.id, v_requirement.required_quantity, v_requirement.current_quantity
        using errcode = '23514';
    end if;
  end loop;

  for v_consumption in
    select i.id, i.unit, i.current_quantity,
           sum(public.convert_recipe_stock_quantity(
             r.quantity_required * oi.quantity,
             r.unit,
             i.unit
           )) as required_quantity
    from public.order_items oi
    join public.menu_items m
      on m.id = oi.menu_item_id
     and m.restaurant_id = oi.restaurant_id
    join public.menu_item_inventory_items r
      on r.menu_item_id = m.id
     and r.restaurant_id = m.restaurant_id
    join public.inventory_items i
      on i.id = r.inventory_item_id
     and i.restaurant_id = r.restaurant_id
    where oi.order_id = v_order.order_id
      and oi.restaurant_id = v_order.restaurant_id
      and m.station = v_order.station
    group by i.id, i.unit, i.current_quantity
    order by i.id
  loop
    update public.inventory_items
    set current_quantity = current_quantity - v_consumption.required_quantity,
        updated_at = v_changed_at
    where id = v_consumption.id
      and restaurant_id = v_order.restaurant_id
      and current_quantity >= v_consumption.required_quantity;

    if not found then
      raise exception 'Inventory changed during station completion; retry the operation.' using errcode = '40001';
    end if;

    insert into public.stock_movements (
      restaurant_id, item_id, movement_type, quantity_delta, unit, reason,
      previous_quantity, new_quantity, performed_by_user_id, related_order_id
    ) values (
      v_order.restaurant_id,
      v_consumption.id,
      'USAGE',
      -v_consumption.required_quantity,
      v_consumption.unit,
      'Completed station order',
      v_consumption.current_quantity,
      v_consumption.current_quantity - v_consumption.required_quantity,
      v_actor_user_id,
      v_order.order_id
    );

    insert into public.inventory_audit_logs (
      restaurant_id, item_id, action, performed_by_user_id,
      previous_quantity, new_quantity, note
    ) values (
      v_order.restaurant_id,
      v_consumption.id,
      'USAGE',
      v_actor_user_id,
      v_consumption.current_quantity,
      v_consumption.current_quantity - v_consumption.required_quantity,
      'Consumed by completed station order'
    );
  end loop;

  update public.kitchen_orders
  set status = 'COMPLETED', updated_at = v_changed_at
  where id = v_order.id
    and restaurant_id = v_order.restaurant_id
    and status = 'PREPARING';

  if not found then
    raise exception 'Station order changed during completion; retry the operation.' using errcode = '40001';
  end if;

  return true;
end;
$$;

revoke execute on function public.complete_station_order(uuid) from public;
grant execute on function public.complete_station_order(uuid) to authenticated;