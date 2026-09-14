-- Normalize legacy role labels without dropping existing memberships.
update public.restaurant_users set role = 'SERVER' where role = 'CASHIER';
update public.restaurant_users set role = 'CHEF' where role = 'KITCHEN';

alter table public.restaurant_users drop constraint if exists restaurant_users_role_check;
alter table public.restaurant_users add constraint restaurant_users_role_check
  check (role in ('ADMIN', 'OWNER', 'MANAGER', 'SERVER', 'CHEF', 'BARMAN'));

create or replace function public.has_restaurant_role(target_restaurant_id uuid, allowed_roles text[])
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.restaurant_users
    where restaurant_id = target_restaurant_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

drop policy if exists "finance roles can read payments" on public.payments;
create policy "finance roles can read payments" on public.payments for select
  using (public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']));
