-- Addis RMS Phase 1: Operations CRUD permissions

-- Categories
create policy "managers can insert categories"
on public.categories
for insert
with check (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER']
  )
);

create policy "managers can update categories"
on public.categories
for update
using (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER']
  )
)
with check (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER']
  )
);

create policy "managers can delete categories"
on public.categories
for delete
using (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER']
  )
);

-- Menu items
create policy "managers can insert menu items"
on public.menu_items
for insert
with check (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER']
  )
);

create policy "managers can update menu items"
on public.menu_items
for update
using (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER']
  )
)
with check (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER']
  )
);

create policy "managers can delete menu items"
on public.menu_items
for delete
using (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER']
  )
);

-- Tables
create policy "managers can insert tables"
on public.tables
for insert
with check (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER']
  )
);

create policy "staff can update table status"
on public.tables
for update
using (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']
  )
)
with check (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']
  )
);

create policy "managers can delete tables"
on public.tables
for delete
using (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER']
  )
);

-- Orders
create policy "service staff can insert orders"
on public.orders
for insert
with check (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']
  )
);

create policy "service staff can update orders"
on public.orders
for update
using (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']
  )
)
with check (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']
  )
);

-- Order items
create policy "service staff can insert order items"
on public.order_items
for insert
with check (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']
  )
);

create policy "service staff can update order items"
on public.order_items
for update
using (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']
  )
)
with check (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']
  )
);

create policy "service staff can delete order items"
on public.order_items
for delete
using (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']
  )
);

-- Kitchen orders
create policy "service staff can insert kitchen orders"
on public.kitchen_orders
for insert
with check (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER', 'CHEF']
  )
);

create policy "kitchen staff can update kitchen orders"
on public.kitchen_orders
for update
using (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER', 'CHEF']
  )
)
with check (
  public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER', 'CHEF']
  )
);
