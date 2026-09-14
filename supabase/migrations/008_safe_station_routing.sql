-- Safely align the live schema with the existing station-aware order workflow.
-- Existing menu items and kitchen orders default to KITCHEN; no business rows are deleted.

alter table public.menu_items
  add column if not exists station text;

update public.menu_items
set station = 'KITCHEN'
where station is null or station not in ('KITCHEN', 'BAR');

alter table public.menu_items
  alter column station set default 'KITCHEN',
  alter column station set not null;

do $$
begin
  if not exists (,
  
    select 1
    from pg_constraint
    where conrelid = 'public.menu_items'::regclass
      and conname = 'menu_items_station_check'
  ) then
    alter table public.menu_items
      add constraint menu_items_station_check
      check (station in ('KITCHEN', 'BAR'));
  end if;
end
$$;

alter table public.kitchen_orders
  add column if not exists station text;

update public.kitchen_orders
set station = 'KITCHEN'
where station is null or station not in ('KITCHEN', 'BAR');

alter table public.kitchen_orders
  alter column station set default 'KITCHEN',
  alter column station set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.kitchen_orders'::regclass
      and conname = 'kitchen_orders_station_check'
  ) then
    alter table public.kitchen_orders
      add constraint kitchen_orders_station_check
      check (station in ('KITCHEN', 'BAR'));
  end if;
end
$$;

alter table public.kitchen_orders
  drop constraint if exists kitchen_orders_order_id_key;

create unique index if not exists kitchen_orders_order_station_key
  on public.kitchen_orders(order_id, station);

create index if not exists kitchen_orders_station_status_idx
  on public.kitchen_orders(restaurant_id, station, status, created_at);

drop policy if exists "members can read kitchen orders" on public.kitchen_orders;
drop policy if exists "service staff can insert kitchen orders" on public.kitchen_orders;
drop policy if exists "kitchen staff can update kitchen orders" on public.kitchen_orders;
drop policy if exists "station staff can read routed orders" on public.kitchen_orders;
drop policy if exists "station staff can update routed orders" on public.kitchen_orders;
drop policy if exists "service roles can insert routed orders" on public.kitchen_orders;

create policy "station staff can read routed orders"
on public.kitchen_orders
for select
using (
  public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER'])
  or public.has_restaurant_role(restaurant_id, array['SERVER'])
  or (
    station = 'KITCHEN'
    and public.has_restaurant_role(restaurant_id, array['CHEF'])
  )
  or (
    station = 'BAR'
    and public.has_restaurant_role(restaurant_id, array['BARMAN'])
  )
);

create policy "service roles can insert routed orders"
on public.kitchen_orders
for insert
with check (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']
  )
);

create policy "station staff can update routed orders"
on public.kitchen_orders
for update
using (
  public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER'])
  or (
    station = 'KITCHEN'
    and public.has_restaurant_role(restaurant_id, array['CHEF'])
  )
  or (
    station = 'BAR'
    and public.has_restaurant_role(restaurant_id, array['BARMAN'])
  )
)
with check (
  public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER'])
  or (
    station = 'KITCHEN'
    and public.has_restaurant_role(restaurant_id, array['CHEF'])
  )
  or (
    station = 'BAR'
    and public.has_restaurant_role(restaurant_id, array['BARMAN'])
  )
);

grant select, insert, update, delete
on public.menu_items, public.kitchen_orders
to authenticated;

alter table public.kitchen_orders replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'kitchen_orders'
  ) then
    alter publication supabase_realtime add table public.kitchen_orders;
  end if;
end
$$;
