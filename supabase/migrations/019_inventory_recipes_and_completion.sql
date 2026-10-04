-- Inventory recipes and atomic station completion for ADDIS RMS V10.

alter table public.inventory_items
  add column if not exists station text not null default 'KITCHEN';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname = 'inventory_items_station_check'
  ) then
    alter table public.inventory_items
      add constraint inventory_items_station_check check (station in ('KITCHEN', 'BAR'));
  end if;
end
$$;

create table if not exists public.menu_item_inventory_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity_required numeric(12, 3) not null check (quantity_required > 0),
  unit text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, menu_item_id, inventory_item_id)
);

create index if not exists menu_item_inventory_items_restaurant_menu_idx
  on public.menu_item_inventory_items (restaurant_id, menu_item_id);

create index if not exists inventory_items_restaurant_station_idx
  on public.inventory_items (restaurant_id, station, is_active);

create or replace function public.validate_menu_inventory_recipe()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_menu_station text;
  v_inventory_station text;
begin
  select station into v_menu_station from public.menu_items
    where id = new.menu_item_id and restaurant_id = new.restaurant_id;
  select station into v_inventory_station from public.inventory_items
    where id = new.inventory_item_id and restaurant_id = new.restaurant_id;
  if v_menu_station is null or v_inventory_station is null then
    raise exception 'Recipe references must belong to the same restaurant.';
  end if;
  if v_menu_station <> v_inventory_station then
    raise exception 'Recipe station must match the menu item station.';
  end if;
  return new;
end;
$$;

create trigger validate_menu_inventory_recipe
before insert or update on public.menu_item_inventory_items
for each row execute function public.validate_menu_inventory_recipe();

create trigger menu_item_inventory_items_updated_at
before update on public.menu_item_inventory_items
for each row execute function public.set_inventory_updated_at();

alter table public.menu_item_inventory_items enable row level security;

create policy "members can read menu inventory recipes"
on public.menu_item_inventory_items for select
using (public.is_restaurant_member(restaurant_id));

create policy "managers can manage menu inventory recipes"
on public.menu_item_inventory_items for all
using (public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']))
with check (public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']));

grant select, insert, update, delete on public.menu_item_inventory_items to authenticated;

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
  if p_performed_by is distinct from auth.uid() then
    raise exception 'The authenticated user must perform the stock movement.';
  end if;
  if p_movement_type not in ('ADD_STOCK', 'ADJUSTMENT') or p_quantity_delta is null or p_quantity_delta = 0 then
    raise exception 'Use a non-zero stock addition or adjustment.';
  end if;
  if not public.has_restaurant_role(p_restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']) then
    raise exception 'Only Admin, Owner, or Manager can update inventory.';
  end if;

  select * into v_item
  from public.inventory_items
  where id = p_item_id and restaurant_id = p_restaurant_id
  for update;
  if not found then
    raise exception 'Inventory item not found in this restaurant.';
  end if;

  if p_movement_type = 'ADD_STOCK' and p_quantity_delta < 0 then
    raise exception 'Stock additions must be positive.';
  end if;
  v_normalized_unit := coalesce(nullif(trim(p_unit), ''), v_item.unit);
  v_previous_quantity := v_item.current_quantity;
  v_new_quantity := v_previous_quantity + p_quantity_delta;
  if v_new_quantity < 0 then
    raise exception 'This stock movement would make the inventory item negative.';
  end if;

  update public.inventory_items
  set current_quantity = v_new_quantity, updated_at = now()
  where id = p_item_id and restaurant_id = p_restaurant_id;

  insert into public.stock_movements (
    restaurant_id, item_id, movement_type, quantity_delta, unit, unit_cost,
    reason, previous_quantity, new_quantity, performed_by_user_id, related_order_id
  ) values (
    p_restaurant_id, p_item_id, p_movement_type, p_quantity_delta, v_normalized_unit,
    p_unit_cost, p_reason, v_previous_quantity, v_new_quantity, auth.uid(), p_related_order_id
  ) returning id into v_stock_movement_id;

  insert into public.inventory_audit_logs (
    restaurant_id, item_id, action, performed_by_user_id,
    previous_quantity, new_quantity, note
  ) values (
    p_restaurant_id, p_item_id, p_movement_type, auth.uid(),
    v_previous_quantity, v_new_quantity, coalesce(p_reason, 'Stock movement recorded')
  );
  return v_stock_movement_id;
end;
$$;

revoke execute on function public.apply_stock_movement(uuid, uuid, text, numeric, text, numeric, text, uuid, uuid) from public;
grant execute on function public.apply_stock_movement(uuid, uuid, text, numeric, text, numeric, text, uuid, uuid) to authenticated;

create or replace function public.complete_station_order(p_kitchen_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_order_item record;
  v_recipe record;
  v_previous_quantity numeric(12,3);
  v_new_quantity numeric(12,3);
  v_required numeric(12,3);
begin
  select ko.id, ko.restaurant_id, ko.station, ko.status, o.id as order_id
  into v_order
  from public.kitchen_orders ko
  join public.orders o on o.id = ko.order_id and o.restaurant_id = ko.restaurant_id
  where ko.id = p_kitchen_order_id
  for update;

  if not found then raise exception 'Station order not found.'; end if;
  if not public.has_restaurant_role(v_order.restaurant_id, array['ADMIN', 'OWNER', 'MANAGER',
    case when v_order.station = 'KITCHEN' then 'CHEF' else 'BARMAN' end]) then
    raise exception 'You do not have permission to complete this station order.';
  end if;
  if v_order.status = 'COMPLETED' then return true; end if;
  if v_order.status <> 'PREPARING' then
    raise exception 'Only orders being prepared can be completed.';
  end if;

  for v_order_item in
    select oi.menu_item_id, oi.quantity
    from public.order_items oi
    where oi.order_id = v_order.order_id and oi.restaurant_id = v_order.restaurant_id
  loop
    for v_recipe in
      select r.quantity_required, r.unit, i.id, i.current_quantity, i.unit as inventory_unit
      from public.menu_item_inventory_items r
      join public.inventory_items i on i.id = r.inventory_item_id and i.restaurant_id = r.restaurant_id
      join public.menu_items m on m.id = r.menu_item_id and m.restaurant_id = r.restaurant_id
      where r.restaurant_id = v_order.restaurant_id
        and r.menu_item_id = v_order_item.menu_item_id
        and m.station = v_order.station
      for update of i
    loop
      v_required := v_recipe.quantity_required * v_order_item.quantity;
      v_previous_quantity := v_recipe.current_quantity;
      v_new_quantity := v_previous_quantity - v_required;
      if v_new_quantity < 0 then
        raise exception 'Insufficient inventory for this order.';
      end if;
      update public.inventory_items set current_quantity = v_new_quantity, updated_at = now()
        where id = v_recipe.id and restaurant_id = v_order.restaurant_id;
      insert into public.stock_movements (
        restaurant_id, item_id, movement_type, quantity_delta, unit, reason,
        previous_quantity, new_quantity, performed_by_user_id, related_order_id
      ) values (
        v_order.restaurant_id, v_recipe.id, 'USAGE', -v_required,
        coalesce(v_recipe.unit, v_recipe.inventory_unit), 'Completed station order',
        v_previous_quantity, v_new_quantity, auth.uid(), v_order.order_id
      );
      insert into public.inventory_audit_logs (
        restaurant_id, item_id, action, performed_by_user_id,
        previous_quantity, new_quantity, note
      ) values (
        v_order.restaurant_id, v_recipe.id, 'USAGE', auth.uid(),
        v_previous_quantity, v_new_quantity, 'Consumed by completed station order'
      );
    end loop;
  end loop;

  update public.kitchen_orders set status = 'COMPLETED', updated_at = now()
  where id = v_order.id and restaurant_id = v_order.restaurant_id and status = 'PREPARING';
  return true;
end;
$$;

revoke execute on function public.complete_station_order(uuid) from public;
grant execute on function public.complete_station_order(uuid) to authenticated;