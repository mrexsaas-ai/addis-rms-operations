create table if not exists public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'SCHEDULED'
    check (status in ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists staff_shifts_restaurant_date_idx
  on public.staff_shifts (restaurant_id, shift_date, start_time);

alter table public.staff_shifts enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'staff_shifts'
      and policyname = 'admins can read staff shifts'
  ) then
    create policy "admins can read staff shifts"
      on public.staff_shifts
      for select
      using (
        public.has_restaurant_role(restaurant_id, array['ADMIN', 'OWNER'])
      );
  end if;
end
$$;

grant select on public.staff_shifts to authenticated;
