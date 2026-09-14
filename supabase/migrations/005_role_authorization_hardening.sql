-- Role authorization hardening. UI checks are not a security boundary.

drop policy if exists "members can read orders" on public.orders;
create policy "operational roles can read orders" on public.orders for select
  using (public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER', 'CHEF', 'BARMAN']
  ));

drop policy if exists "service staff can insert kitchen orders" on public.kitchen_orders;
create policy "service staff can insert kitchen orders" on public.kitchen_orders
  for insert with check (public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']
  ));

drop policy if exists "kitchen staff can update kitchen orders" on public.kitchen_orders;
create policy "kitchen staff can update kitchen orders" on public.kitchen_orders
  for update
  using (public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER', 'CHEF']))
  with check (public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER', 'CHEF']));

create policy "service roles can insert payments" on public.payments
  for insert with check (public.has_restaurant_role(
    restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']
  ));

create policy "service roles can update payments" on public.payments
  for update
  using (public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']))
  with check (public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']));

grant insert, update on public.payments to authenticated;