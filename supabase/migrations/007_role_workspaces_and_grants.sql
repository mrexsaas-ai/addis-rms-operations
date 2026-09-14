-- Grants and payment read access for the current workspace.

grant select, insert, update, delete on public.categories, public.menu_items, public.tables,
  public.orders, public.order_items, public.kitchen_orders, public.payments to authenticated;

drop policy if exists "finance roles can read payments" on public.payments;
create policy "finance roles can read payments" on public.payments
  for select
  using (public.has_restaurant_role(
    restaurant_id, array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']
  ));
