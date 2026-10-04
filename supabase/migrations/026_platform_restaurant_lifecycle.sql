alter table public.restaurants
  add column if not exists status text;

update public.restaurants
set status = 'ACTIVE'
where status is null;

alter table public.restaurants
  alter column status set default 'ACTIVE',
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_status_check'
  ) then
    alter table public.restaurants
      add constraint restaurants_status_check
      check (status in ('ACTIVE', 'INACTIVE'));
  end if;
end
$$;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

revoke all on table public.platform_admins from public, anon, authenticated;
grant select on table public.platform_admins to authenticated;

drop policy if exists "platform admins can read own platform membership" on public.platform_admins;
create policy "platform admins can read own platform membership"
  on public.platform_admins
  for select
  using (user_id = auth.uid());

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.platform_admins
      where user_id = auth.uid()
    );
$$;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create or replace function public.is_restaurant_member(target_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.restaurant_users ru
      join public.restaurants r on r.id = ru.restaurant_id
      where ru.restaurant_id = target_restaurant_id
        and ru.user_id = auth.uid()
        and r.status = 'ACTIVE'
    );
$$;

revoke all on function public.is_restaurant_member(uuid) from public, anon;
grant execute on function public.is_restaurant_member(uuid) to authenticated;

create or replace function public.is_active_restaurant_member(target_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.restaurant_users ru
      join public.restaurants r on r.id = ru.restaurant_id
      where ru.restaurant_id = target_restaurant_id
        and ru.user_id = auth.uid()
        and r.status = 'ACTIVE'
    );
$$;

revoke all on function public.is_active_restaurant_member(uuid) from public, anon;
grant execute on function public.is_active_restaurant_member(uuid) to authenticated;

create or replace function public.has_restaurant_role(target_restaurant_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.restaurant_users ru
      join public.restaurants r on r.id = ru.restaurant_id
      where ru.restaurant_id = target_restaurant_id
        and ru.user_id = auth.uid()
        and ru.role = any(allowed_roles)
        and r.status = 'ACTIVE'
    );
$$;

revoke all on function public.has_restaurant_role(uuid, text[]) from public, anon;
grant execute on function public.has_restaurant_role(uuid, text[]) to authenticated;

drop policy if exists "members can read restaurant membership" on public.restaurant_users;
create policy "users can read own or active restaurant membership"
  on public.restaurant_users
  for select
  using (
    user_id = auth.uid()
    or public.is_active_restaurant_member(restaurant_id)
  );

drop policy if exists "members can read categories" on public.categories;
create policy "active members can read categories"
  on public.categories
  for select
  using (public.is_active_restaurant_member(restaurant_id));

drop policy if exists "members can read menu items" on public.menu_items;
create policy "active members can read menu items"
  on public.menu_items
  for select
  using (public.is_active_restaurant_member(restaurant_id));

drop policy if exists "members can read tables" on public.tables;
create policy "active members can read tables"
  on public.tables
  for select
  using (public.is_active_restaurant_member(restaurant_id));

drop policy if exists "members can read order items" on public.order_items;
create policy "active members can read order items"
  on public.order_items
  for select
  using (public.is_active_restaurant_member(restaurant_id));

drop policy if exists "station staff can read routed orders" on public.kitchen_orders;
create policy "station staff can read routed orders"
  on public.kitchen_orders
  for select
  using (
    public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER', 'SERVER'])
    or (station = 'KITCHEN' and public.has_restaurant_role(restaurant_id, array['CHEF']))
    or (station = 'BAR' and public.has_restaurant_role(restaurant_id, array['BARMAN']))
  );

drop policy if exists "members can read inventory categories" on public.inventory_categories;
create policy "active members can read inventory categories"
  on public.inventory_categories for select
  using (public.is_active_restaurant_member(restaurant_id));

drop policy if exists "members can read suppliers" on public.suppliers;
create policy "active members can read suppliers"
  on public.suppliers for select
  using (public.is_active_restaurant_member(restaurant_id));

drop policy if exists "members can read inventory items" on public.inventory_items;
create policy "active members can read inventory items"
  on public.inventory_items for select
  using (public.is_active_restaurant_member(restaurant_id));

drop policy if exists "members can read stock movements" on public.stock_movements;
create policy "active members can read stock movements"
  on public.stock_movements for select
  using (public.is_active_restaurant_member(restaurant_id));

drop policy if exists "requesters and managers can read stock requests" on public.stock_requests;
create policy "active requesters and managers can read stock requests"
  on public.stock_requests for select
  using (
    public.is_active_restaurant_member(restaurant_id)
    and (
      requested_by_user_id = auth.uid()
      or public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER'])
    )
  );

drop policy if exists "members can read inventory audit logs" on public.inventory_audit_logs;
create policy "active members can read inventory audit logs"
  on public.inventory_audit_logs for select
  using (public.is_active_restaurant_member(restaurant_id));

drop policy if exists "members can read menu inventory recipes" on public.menu_item_inventory_items;
create policy "active members can read menu inventory recipes"
  on public.menu_item_inventory_items for select
  using (public.is_active_restaurant_member(restaurant_id));

drop policy if exists "members can read restaurant settings" on public.restaurant_settings;
create policy "active members can read restaurant settings"
  on public.restaurant_settings for select
  using (public.is_active_restaurant_member(restaurant_id));

drop policy if exists "members can read active payment accounts" on public.payment_accounts;
create policy "active members can read active payment accounts"
  on public.payment_accounts for select
  using (public.is_active_restaurant_member(restaurant_id) and is_active = true);

drop policy if exists "members can read restaurant payment audit events" on public.payment_audit_events;
create policy "active members can read restaurant payment audit events"
  on public.payment_audit_events for select
  using (public.is_active_restaurant_member(restaurant_id));

drop policy if exists "restaurant staff can insert payment audit events" on public.payment_audit_events;
create policy "active restaurant staff can insert payment audit events"
  on public.payment_audit_events for insert
  with check (
    public.is_active_restaurant_member(restaurant_id)
    and actor_user_id = auth.uid()
  );

revoke update on table public.restaurants from public, anon, authenticated;
grant update (name, business_legal_name, description, phone, address, logo_url, updated_at)
  on table public.restaurants to authenticated;

create table if not exists public.restaurant_status_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  previous_status text not null check (previous_status in ('ACTIVE', 'INACTIVE')),
  new_status text not null check (new_status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  check (previous_status <> new_status)
);

create index if not exists restaurant_status_events_restaurant_created_idx
  on public.restaurant_status_events (restaurant_id, created_at desc);

alter table public.restaurant_status_events enable row level security;
revoke all on table public.restaurant_status_events from public, anon, authenticated;
grant select on table public.restaurant_status_events to authenticated;

create policy "platform admins can read restaurant status events"
  on public.restaurant_status_events for select
  using (public.is_platform_admin());

create or replace function public.set_restaurant_status(
  p_restaurant_id uuid,
  p_new_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_previous_status text;
  v_changed_at timestamptz;
begin
  if v_actor_user_id is null or not public.is_platform_admin() then
    raise exception 'Platform administrator access is required.' using errcode = '42501';
  end if;

  if p_restaurant_id is null then
    raise exception 'Restaurant is required.' using errcode = '22004';
  end if;

  if p_new_status is null or p_new_status not in ('ACTIVE', 'INACTIVE') then
    raise exception 'Restaurant status must be ACTIVE or INACTIVE.' using errcode = '22023';
  end if;

  select status
    into v_previous_status
  from public.restaurants
  where id = p_restaurant_id
  for update;

  if not found then
    raise exception 'Restaurant was not found.' using errcode = 'P0002';
  end if;

  if v_previous_status = p_new_status then
    return jsonb_build_object(
      'restaurant_id', p_restaurant_id,
      'previous_status', v_previous_status,
      'new_status', p_new_status,
      'changed', false
    );
  end if;

  v_changed_at := clock_timestamp();

  update public.restaurants
  set status = p_new_status,
      updated_at = v_changed_at
  where id = p_restaurant_id;

  insert into public.restaurant_status_events (
    restaurant_id,
    actor_user_id,
    previous_status,
    new_status,
    created_at
  ) values (
    p_restaurant_id,
    v_actor_user_id,
    v_previous_status,
    p_new_status,
    v_changed_at
  );

  return jsonb_build_object(
    'restaurant_id', p_restaurant_id,
    'previous_status', v_previous_status,
    'new_status', p_new_status,
    'created_at', v_changed_at,
    'changed', true
  );
end;
$$;

revoke all on function public.set_restaurant_status(uuid, text) from public, anon;
grant execute on function public.set_restaurant_status(uuid, text) to authenticated;