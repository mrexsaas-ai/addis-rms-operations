-- Allow Kitchen and Bar to request stock that has not yet been catalogued.
-- Management must map a free-text request to an existing inventory item before fulfillment.

alter table public.stock_requests
  alter column item_id drop not null,
  add column if not exists requested_item_name text,
  add column if not exists station text;

update public.stock_requests sr
set requested_item_name = coalesce(sr.requested_item_name, i.name),
    station = coalesce(sr.station, i.station)
from public.inventory_items i
where i.id = sr.item_id;

alter table public.stock_requests
  drop constraint if exists stock_requests_requested_item_name_check,
  drop constraint if exists stock_requests_station_check,
  add constraint stock_requests_requested_item_name_check check (requested_item_name is not null and length(trim(requested_item_name)) > 0),
  add constraint stock_requests_station_check check (station in ('KITCHEN', 'BAR'));

create index if not exists stock_requests_restaurant_station_status_idx
  on public.stock_requests (restaurant_id, station, status, created_at desc);

create or replace function public.validate_stock_request_station()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_item_station text;
  v_role text;
begin
  if new.requested_by_user_id is distinct from auth.uid() then
    raise exception 'The authenticated user must create the stock request.';
  end if;
  if new.requested_item_name is null or length(trim(new.requested_item_name)) = 0 then
    raise exception 'Requested item name is required.';
  end if;
  if new.station not in ('KITCHEN', 'BAR') then
    raise exception 'A valid request station is required.';
  end if;

  select role into v_role from public.restaurant_users
    where restaurant_id = new.restaurant_id and user_id = auth.uid();
  if v_role = 'CHEF' and new.station <> 'KITCHEN' then
    raise exception 'Chef requests must use Kitchen.';
  end if;
  if v_role = 'BARMAN' and new.station <> 'BAR' then
    raise exception 'Barman requests must use Bar.';
  end if;

  if new.item_id is not null then
    select station into v_item_station from public.inventory_items
      where id = new.item_id and restaurant_id = new.restaurant_id;
    if v_item_station is null then raise exception 'Inventory item not found in this restaurant.'; end if;
    if v_item_station <> new.station then raise exception 'Inventory item station does not match the request.'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.fulfill_stock_request_with_item(
  p_request_id uuid,
  p_inventory_item_id uuid,
  p_performed_by uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
  v_item record;
  v_movement_id uuid;
begin
  if p_performed_by is distinct from auth.uid() then
    raise exception 'The authenticated user must fulfill the request.';
  end if;
  select * into v_request from public.stock_requests where id = p_request_id for update;
  if not found then raise exception 'Stock request not found.'; end if;
  if not public.has_restaurant_role(v_request.restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']) then
    raise exception 'Only management can fulfill stock requests.';
  end if;
  if v_request.status <> 'APPROVED' then raise exception 'Only approved requests can be fulfilled.'; end if;

  select id, station, unit into v_item
  from public.inventory_items
  where id = p_inventory_item_id and restaurant_id = v_request.restaurant_id and is_active = true;
  if not found then raise exception 'Inventory item not found in this restaurant.'; end if;
  if v_item.station <> v_request.station then raise exception 'Inventory item station does not match the request.'; end if;

  update public.stock_requests
  set item_id = v_item.id, unit = v_item.unit, updated_at = now()
  where id = v_request.id and restaurant_id = v_request.restaurant_id and status = 'APPROVED';

  v_movement_id := public.apply_stock_movement(
    v_request.restaurant_id, v_item.id, 'ADD_STOCK', v_request.quantity,
    v_item.unit, null, coalesce(p_reason, 'Stock request fulfilled'), auth.uid(), null
  );

  update public.stock_requests
  set status = 'FULFILLED', approved_by_user_id = auth.uid(), reviewed_at = now(), updated_at = now(),
      note = coalesce(p_reason, note)
  where id = v_request.id and restaurant_id = v_request.restaurant_id and status = 'APPROVED';
  return v_movement_id;
end;
$$;

revoke execute on function public.fulfill_stock_request_with_item(uuid, uuid, uuid, text) from public;
grant execute on function public.fulfill_stock_request_with_item(uuid, uuid, uuid, text) to authenticated;