create extension if not exists "pgcrypto";

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(), name text not null, description text, phone text,
  address text, logo_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade, full_name text, avatar_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.restaurant_users (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('OWNER', 'MANAGER', 'CASHIER', 'SERVER', 'KITCHEN')),
  created_at timestamptz not null default now(), unique (restaurant_id, user_id)
);
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null, name text not null, description text,
  price numeric(12, 2) not null check (price >= 0), image_url text, is_available boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_number integer not null, name text, capacity integer not null default 2 check (capacity > 0),
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (restaurant_id, table_number)
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid references public.tables(id) on delete set null, created_by uuid references auth.users(id) on delete set null,
  order_number text not null, status text not null default 'NEW' check (status in ('NEW', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED')),
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0), total numeric(12, 2) not null default 0 check (total >= 0),
  notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (restaurant_id, order_number)
);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade, menu_item_id uuid references public.menu_items(id) on delete set null,
  quantity integer not null check (quantity > 0), unit_price numeric(12, 2) not null check (unit_price >= 0),
  subtotal numeric(12, 2) not null check (subtotal >= 0), notes text, created_at timestamptz not null default now()
);
create table if not exists public.kitchen_orders (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade, status text not null default 'NEW' check (status in ('NEW', 'PREPARING', 'READY', 'COMPLETED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (order_id)
);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade, amount numeric(12, 2) not null check (amount >= 0),
  method text not null check (method in ('CASH', 'TELEBIRR', 'BANK_TRANSFER')),
  status text not null default 'PENDING' check (status in ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED')),
  received_by uuid references auth.users(id) on delete set null, reference_number text, created_at timestamptz not null default now()
);

create index if not exists orders_restaurant_created_at_idx on public.orders (restaurant_id, created_at desc);
create index if not exists orders_restaurant_status_idx on public.orders (restaurant_id, status);
create index if not exists payments_restaurant_created_at_idx on public.payments (restaurant_id, created_at desc);
create index if not exists order_items_restaurant_idx on public.order_items (restaurant_id);

create or replace function public.is_restaurant_member(target_restaurant_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.restaurant_users where restaurant_id = target_restaurant_id and user_id = auth.uid());
$$;

create or replace function public.has_restaurant_role(target_restaurant_id uuid, allowed_roles text[])
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.restaurant_users where restaurant_id = target_restaurant_id and user_id = auth.uid() and role = any(allowed_roles));
$$;

alter table public.restaurants enable row level security;
alter table public.profiles enable row level security;
alter table public.restaurant_users enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.tables enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.kitchen_orders enable row level security;
alter table public.payments enable row level security;

create policy "members can read their restaurants" on public.restaurants for select using (public.is_restaurant_member(id));
create policy "users can read their profile" on public.profiles for select using (id = auth.uid());
create policy "members can read restaurant membership" on public.restaurant_users for select using (public.is_restaurant_member(restaurant_id));
create policy "members can read categories" on public.categories for select using (public.is_restaurant_member(restaurant_id));
create policy "members can read menu items" on public.menu_items for select using (public.is_restaurant_member(restaurant_id));
create policy "members can read tables" on public.tables for select using (public.is_restaurant_member(restaurant_id));
create policy "members can read orders" on public.orders for select using (public.is_restaurant_member(restaurant_id));
create policy "members can read order items" on public.order_items for select using (public.is_restaurant_member(restaurant_id));
create policy "members can read kitchen orders" on public.kitchen_orders for select using (public.is_restaurant_member(restaurant_id));
create policy "finance roles can read payments" on public.payments for select using (public.has_restaurant_role(restaurant_id, array['OWNER', 'MANAGER', 'CASHIER']));

grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
