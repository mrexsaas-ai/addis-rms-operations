alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('NEW', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED', 'PAID'));

alter table public.payments
  add column if not exists cash_received numeric(12, 2),
  add column if not exists change_amount numeric(12, 2);

create unique index if not exists payments_restaurant_reference_key
  on public.payments (restaurant_id, reference_number)
  where reference_number is not null;

drop policy if exists "finance roles can read payments" on public.payments;
create policy "operational roles can read payments"
  on public.payments
  for select
  using (
    public.has_restaurant_role(
      restaurant_id,
      array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']
    )
  );

create policy "members can read active payment accounts"
  on public.payment_accounts
  for select
  using (public.is_restaurant_member(restaurant_id) and is_active = true);

grant select on public.payment_accounts to authenticated;
