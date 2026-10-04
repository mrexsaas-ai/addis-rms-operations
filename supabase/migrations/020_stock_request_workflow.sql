-- Realtime and atomic fulfillment for station stock requests.

alter table public.stock_requests replica identity full;

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
  select station into v_item_station from public.inventory_items
    where id = new.item_id and restaurant_id = new.restaurant_id;
  if v_item_station is null then raise exception 'Inventory item not found in this restaurant.'; end if;
  select role into v_role from public.restaurant_users
    where restaurant_id = new.restaurant_id and user_id = auth.uid();
  if v_role = 'CHEF' and v_item_station <> 'KITCHEN' then
    raise exception 'Chef requests must use Kitchen inventory.';
  end if;
  if v_role = 'BARMAN' and v_item_station <> 'BAR' then
    raise exception 'Barman requests must use Bar inventory.';
  end if;
  return new;
end;
$$;

create trigger validate_stock_request_station
before insert on public.stock_requests
for each row execute function public.validate_stock_request_station();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'stock_requests'
  ) then
    alter publication supabase_realtime add table public.stock_requests;
  end if;
end
$$;

create or replace function public.fulfill_stock_request(
  p_request_id uuid,
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
  v_movement_id uuid;
begin
  if p_performed_by is distinct from auth.uid() then
    raise exception 'The authenticated user must fulfill the request.';
  end if;

  select * into v_request
  from public.stock_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'Stock request not found.'; end if;
  if not public.has_restaurant_role(v_request.restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']) then
    raise exception 'Only management can fulfill stock requests.';
  end if;
  if v_request.status <> 'APPROVED' then
    raise exception 'Only approved requests can be fulfilled.';
  end if;

  v_movement_id := public.apply_stock_movement(
    v_request.restaurant_id,
    v_request.item_id,
    'ADD_STOCK',
    v_request.quantity,
    v_request.unit,
    null,
    coalesce(p_reason, 'Stock request fulfilled'),
    auth.uid(),
    null
  );

  update public.stock_requests
  set status = 'FULFILLED', approved_by_user_id = auth.uid(), reviewed_at = now(), updated_at = now(),
      note = coalesce(p_reason, note)
  where id = v_request.id and restaurant_id = v_request.restaurant_id and status = 'APPROVED';

  return v_movement_id;
end;
$$;

revoke execute on function public.fulfill_stock_request(uuid, uuid, text) from public;
grant execute on function public.fulfill_stock_request(uuid, uuid, text) to authenticated;