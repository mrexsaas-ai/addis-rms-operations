alter table public.menu_items
  add column if not exists station text not null default 'KITCHEN';

alter table public.menu_items
  drop constraint if exists menu_items_station_check;

alter table public.menu_items
  add constraint menu_items_station_check check (station in ('KITCHEN', 'BAR'));

alter table public.kitchen_orders
  add column if not exists station text not null default 'KITCHEN';

alter table public.kitchen_orders
  drop constraint if exists kitchen_orders_station_check;

alter table public.kitchen_orders
  add constraint kitchen_orders_station_check check (station in ('KITCHEN', 'BAR'));

alter table public.kitchen_orders drop constraint if exists kitchen_orders_order_id_key;
create unique index if not exists kitchen_orders_order_station_key
  on public.kitchen_orders(order_id, station);
create index if not exists kitchen_orders_station_status_idx
  on public.kitchen_orders(restaurant_id, station, status, created_at);

drop policy if exists "members can read kitchen orders" on public.kitchen_orders;
create policy "station staff can read routed orders" on public.kitchen_orders for select
  using (
    public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER'])
    or (station = 'KITCHEN' and public.has_restaurant_role(restaurant_id, array['CHEF']))
    or (station = 'BAR' and public.has_restaurant_role(restaurant_id, array['BARMAN']))
    or public.has_restaurant_role(restaurant_id, array['SERVER'])
  );

drop policy if exists "kitchen staff can update kitchen orders" on public.kitchen_orders;
create policy "station staff can update routed orders" on public.kitchen_orders for update
  using (
    public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER'])
    or (station = 'KITCHEN' and public.has_restaurant_role(restaurant_id, array['CHEF']))
    or (station = 'BAR' and public.has_restaurant_role(restaurant_id, array['BARMAN']))
  )
  with check (
    public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER'])
    or (station = 'KITCHEN' and public.has_restaurant_role(restaurant_id, array['CHEF']))
    or (station = 'BAR' and public.has_restaurant_role(restaurant_id, array['BARMAN']))
  );

alter table public.kitchen_orders replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'kitchen_orders'
  ) then
    alter publication supabase_realtime add table public.kitchen_orders;
  end if;
end
$$;