-- 004_settings.sql
-- Addis RMS Settings Foundation

create table if not exists public.restaurant_settings (
  restaurant_id uuid primary key
    references public.restaurants(id) on delete cascade,

  currency text not null default 'ETB'
    check (currency = 'ETB'),

  default_language text not null default 'en'
    check (default_language in ('en', 'am', 'om', 'ti')),

  receipt_language text not null default 'en'
    check (receipt_language = 'en'),

  receipt_footer text,

  enabled_payment_methods text[] not null
    default array['CASH', 'TELEBIRR', 'BANK_TRANSFER'],

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_accounts (
  id uuid primary key default gen_random_uuid(),

  restaurant_id uuid not null
    references public.restaurants(id) on delete cascade,

  type text not null
    check (type in ('BANK_TRANSFER', 'TELEBIRR')),

  name text not null,
  account_name text,
  account_number text,
  qr_code_url text,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.restaurant_settings enable row level security;
alter table public.payment_accounts enable row level security;


-- Restaurant settings: read policy
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'restaurant_settings'
      and policyname = 'members can read restaurant settings'
  ) then
    create policy "members can read restaurant settings"
    on public.restaurant_settings
    for select
    using (
      public.is_restaurant_member(restaurant_id)
    );
  end if;
end
$$;


-- Restaurant settings: insert policy
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'restaurant_settings'
      and policyname = 'admins can insert restaurant settings'
  ) then
    create policy "admins can insert restaurant settings"
    on public.restaurant_settings
    for insert
    with check (
      public.has_restaurant_role(
        restaurant_id,
        array['ADMIN', 'OWNER']
      )
    );
  end if;
end
$$;


-- Restaurant settings: update policy
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'restaurant_settings'
      and policyname = 'admins can update restaurant settings'
  ) then
    create policy "admins can update restaurant settings"
    on public.restaurant_settings
    for update
    using (
      public.has_restaurant_role(
        restaurant_id,
        array['ADMIN', 'OWNER']
      )
    )
    with check (
      public.has_restaurant_role(
        restaurant_id,
        array['ADMIN', 'OWNER']
      )
    );
  end if;
end
$$;


-- Payment accounts policy
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_accounts'
      and policyname = 'admins can manage payment accounts'
  ) then
    create policy "admins can manage payment accounts"
    on public.payment_accounts
    for all
    using (
      public.has_restaurant_role(
        restaurant_id,
        array['ADMIN', 'OWNER']
      )
    )
    with check (
      public.has_restaurant_role(
        restaurant_id,
        array['ADMIN', 'OWNER']
      )
    );
  end if;
end
$$;


-- Restaurant information update
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'restaurants'
      and policyname = 'admins can update restaurants'
  ) then
    create policy "admins can update restaurants"
    on public.restaurants
    for update
    using (
      public.has_restaurant_role(
        id,
        array['ADMIN', 'OWNER']
      )
    )
    with check (
      public.has_restaurant_role(
        id,
        array['ADMIN', 'OWNER']
      )
    );
  end if;
end
$$;


grant select, insert, update
on public.restaurant_settings
to authenticated;

grant select, insert, update, delete
on public.payment_accounts
to authenticated;

grant update
on public.restaurants
to authenticated;