revoke update on table public.kitchen_orders from public, anon, authenticated;

create or replace function public.start_station_order(p_kitchen_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order record;
  v_actor_user_id uuid := auth.uid();
begin
  if v_actor_user_id is null then
    raise exception 'You must be signed in to start a station order.' using errcode = '42501';
  end if;

  select ko.id, ko.restaurant_id, ko.station, ko.status
    into v_order
  from public.kitchen_orders ko
  where ko.id = p_kitchen_order_id
  for update of ko;

  if not found then
    raise exception 'Station order not found.' using errcode = 'P0002';
  end if;

  if not public.has_restaurant_role(
    v_order.restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', case when v_order.station = 'KITCHEN' then 'CHEF' else 'BARMAN' end]
  ) then
    raise exception 'You do not have permission to start this station order.' using errcode = '42501';
  end if;

  if v_order.status <> 'NEW' then
    raise exception 'Only new station orders can be started.' using errcode = '23514';
  end if;

  update public.kitchen_orders
  set status = 'PREPARING', updated_at = now()
  where id = v_order.id
    and restaurant_id = v_order.restaurant_id
    and station = v_order.station
    and status = 'NEW';

  if not found then
    raise exception 'Station order changed while it was being started; retry the operation.' using errcode = '40001';
  end if;

  return true;
end;
$$;

revoke all on function public.start_station_order(uuid) from public, anon, authenticated;
grant execute on function public.start_station_order(uuid) to authenticated;