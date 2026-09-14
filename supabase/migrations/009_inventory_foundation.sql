-- 009_inventory_foundation.sql
-- Inventory foundation for ADDIS RMS V9.

create extension if not exists "pgcrypto";

create table if not exists public.inventory_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid references public.inventory_categories(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  name text not null,
  sku text,
  description text,
  unit text not null,
  current_quantity numeric(12, 3) not null default 0 check (current_quantity >= 0),
  minimum_stock_level numeric(12, 3) not null default 0 check (minimum_stock_level >= 0),
  cost_price numeric(12, 2) not null default 0 check (cost_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_unique_restaurant_sku unique (restaurant_id, sku)
    deferrable initially immediate
    -- `sku` uniqueness is only enforced when a value is present.
    -- This is implemented with a partial unique index below for compatibility.
);

create unique index if not exists inventory_items_restaurant_sku_uidx
  on public.inventory_items (restaurant_id, sku)
  where sku is not null;

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('ADD_STOCK', 'USAGE', 'ADJUSTMENT', 'TRANSFER', 'RETURN', 'WASTE', 'REJECTED')),
  quantity_delta numeric(12, 3) not null check (quantity_delta != 0),
  unit text not null,
  unit_cost numeric(12, 2),
  reason text,
  previous_quantity numeric(12, 3) not null,
  new_quantity numeric(12, 3) not null,
  performed_by_user_id uuid not null references auth.users(id) on delete set null,
  related_order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  requested_by_user_id uuid not null references auth.users(id) on delete cascade,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.inventory_audit_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  action text not null,
  performed_by_user_id uuid not null references auth.users(id) on delete set null,
  previous_quantity numeric(12, 3) not null,
  new_quantity numeric(12, 3) not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_categories_restaurant_name_idx
  on public.inventory_categories (restaurant_id, name);

create index if not exists suppliers_restaurant_name_idx
  on public.suppliers (restaurant_id, name);

create index if not exists inventory_items_restaurant_idx
  on public.inventory_items (restaurant_id, created_at desc);

create index if not exists inventory_items_restaurant_category_idx
  on public.inventory_items (restaurant_id, category_id);

create index if not exists inventory_items_restaurant_supplier_idx
  on public.inventory_items (restaurant_id, supplier_id);

create index if not exists inventory_items_low_stock_idx
  on public.inventory_items (restaurant_id, is_active, current_quantity, minimum_stock_level);

create index if not exists stock_movements_restaurant_item_created_idx
  on public.stock_movements (restaurant_id, item_id, created_at desc);

create index if not exists stock_requests_restaurant_status_created_idx
  on public.stock_requests (restaurant_id, status, created_at desc);

create index if not exists inventory_audit_logs_restaurant_item_created_idx
  on public.inventory_audit_logs (restaurant_id, item_id, created_at desc);

create or replace function public.set_inventory_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger inventory_categories_updated_at
before update on public.inventory_categories
for each row execute function public.set_inventory_updated_at();

create trigger suppliers_updated_at
before update on public.suppliers
for each row execute function public.set_inventory_updated_at();

create trigger inventory_items_updated_at
before update on public.inventory_items
for each row execute function public.set_inventory_updated_at();

create trigger stock_requests_updated_at
before update on public.stock_requests
for each row execute function public.set_inventory_updated_at();

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
  if p_restaurant_id is null then
    raise exception 'Restaurant is required.';
  end if;

  if p_item_id is null then
    raise exception 'Item is required.';
  end if;

  if p_movement_type not in ('ADD_STOCK', 'USAGE', 'ADJUSTMENT', 'TRANSFER', 'RETURN', 'WASTE', 'REJECTED') then
    raise exception 'Unsupported stock movement type.';
  end if;

  if p_quantity_delta is null or p_quantity_delta = 0 then
    raise exception 'Stock delta must be non-zero.';
  end if;

  if not public.has_restaurant_role(
    p_restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER', 'CHEF', 'BARMAN']
  ) then
    raise exception 'You do not have permission to update inventory for this restaurant.';
  end if;

  if p_movement_type in ('ADD_STOCK', 'RETURN') and p_quantity_delta < 0 then
    raise exception 'Add stock and return movements must use a positive quantity.';
  end if;

  if p_movement_type in ('USAGE', 'WASTE', 'REJECTED') and p_quantity_delta > 0 then
    raise exception 'Usage, waste, and rejected movements must use a negative quantity or a reduction.';
  end if;

  select *
  into v_item
  from public.inventory_items
  where id = p_item_id and restaurant_id = p_restaurant_id
  for update;

  if not found then
    raise exception 'Inventory item not found in this restaurant.';
  end if;

  v_normalized_unit := coalesce(nullif(trim(p_unit), ''), v_item.unit);
  v_previous_quantity := v_item.current_quantity;
  v_new_quantity := v_previous_quantity + p_quantity_delta;

  if v_new_quantity < 0 then
    raise exception 'This stock movement would make the inventory item negative.';
  end if;

  update public.inventory_items
    set current_quantity = v_new_quantity,
        updated_at = now()
  where id = p_item_id;

  insert into public.stock_movements (
    restaurant_id,
    item_id,
    movement_type,
    quantity_delta,
    unit,
    unit_cost,
    reason,
    previous_quantity,
    new_quantity,
    performed_by_user_id,
    related_order_id
  ) values (
    p_restaurant_id,
    p_item_id,
    p_movement_type,
    p_quantity_delta,
    v_normalized_unit,
    p_unit_cost,
    p_reason,
    v_previous_quantity,
    v_new_quantity,
    p_performed_by,
    p_related_order_id
  ) returning id into v_stock_movement_id;

  insert into public.inventory_audit_logs (
    restaurant_id,
    item_id,
    action,
    performed_by_user_id,
    previous_quantity,
    new_quantity,
    note
  ) values (
    p_restaurant_id,
    p_item_id,
    p_movement_type,
    p_performed_by,
    v_previous_quantity,
    v_new_quantity,
    coalesce(p_reason, 'Stock movement recorded')
  );

  return v_stock_movement_id;
end;
$$;

grant execute on function public.apply_stock_movement to authenticated;

alter table public.inventory_categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.inventory_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_requests enable row level security;
alter table public.inventory_audit_logs enable row level security;

create policy "members can read inventory categories"
on public.inventory_categories for select
using (public.is_restaurant_member(restaurant_id));

create policy "managers can manage inventory categories"
on public.inventory_categories for all
using (public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']))
with check (public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']));

create policy "members can read suppliers"
on public.suppliers for select
using (public.is_restaurant_member(restaurant_id));

create policy "managers can manage suppliers"
on public.suppliers for all
using (public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']))
with check (public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']));

create policy "members can read inventory items"
on public.inventory_items for select
using (public.is_restaurant_member(restaurant_id));

create policy "managers can manage inventory items"
on public.inventory_items for all
using (public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']))
with check (public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']));

create policy "members can read stock movements"
on public.stock_movements for select
using (public.is_restaurant_member(restaurant_id));

create policy "restaurant staff can add stock movements"
on public.stock_movements for insert
with check (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER', 'CHEF', 'BARMAN']
  )
);

create policy "managers can modify stock movements"
on public.stock_movements for update
using (public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']))
with check (public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']));

create policy "managers can delete stock movements"
on public.stock_movements for delete
using (public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']));

create policy "requesters and managers can read stock requests"
on public.stock_requests for select
using (
  requested_by_user_id = auth.uid()
  or public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER'])
);

create policy "chef and barman can create stock requests"
on public.stock_requests for insert
with check (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'CHEF', 'BARMAN']
  )
  and requested_by_user_id = auth.uid()
);

create policy "managers can review stock requests"
on public.stock_requests for update
using (public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']))
with check (public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']));

create policy "members can read inventory audit logs"
on public.inventory_audit_logs for select
using (public.is_restaurant_member(restaurant_id));

create policy "staff can create inventory audit logs through protected functions"
on public.inventory_audit_logs for insert
with check (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER', 'CHEF', 'BARMAN']
  )
);

create policy "managers can update inventory audit logs"
on public.inventory_audit_logs for update
using (public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']))
with check (public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER']));

grant select, insert, update, delete on public.inventory_categories to authenticated;
grant select, insert, update, delete on public.suppliers to authenticated;
grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert, update, delete on public.stock_movements to authenticated;
grant select, insert, update, delete on public.stock_requests to authenticated;
grant select, insert, update, delete on public.inventory_audit_logs to authenticated;
