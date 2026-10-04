-- Ensure the authenticated restaurant workflow can create, read, and update payment records
-- without weakening tenant isolation or bypassing policy enforcement.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'operational roles can read payments'
  ) then
    create policy "operational roles can read payments"
      on public.payments
      for select
      using (
        public.has_restaurant_role(
          restaurant_id,
          array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'service roles can insert payments'
  ) then
    create policy "service roles can insert payments"
      on public.payments
      for insert
      with check (
        public.has_restaurant_role(
          restaurant_id,
          array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'service roles can update payments'
  ) then
    create policy "service roles can update payments"
      on public.payments
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
  end if;
end $$;

grant select, insert, update, delete on public.payments to authenticated;
