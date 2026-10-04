-- Synchronize only the payment schema changes missing from migrations 010 and 020.
-- This migration is idempotent and does not alter payment_accounts or application code.

do $$
declare
  status_constraint_definition text;
begin
  select pg_get_constraintdef(oid)
    into status_constraint_definition
  from pg_constraint
  where conrelid = 'public.orders'::regclass
    and conname = 'orders_status_check';

  if status_constraint_definition is null then
    alter table public.orders
      add constraint orders_status_check
      check (status in ('NEW', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED', 'PAID'));
  elsif status_constraint_definition not ilike '%PAID%' then
    alter table public.orders
      drop constraint orders_status_check;

    alter table public.orders
      add constraint orders_status_check
      check (status in ('NEW', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED', 'PAID'));
  end if;
end
$$;

alter table public.payments
  add column if not exists confirmed_by uuid references auth.users(id) on delete set null,
  add column if not exists confirmed_at timestamptz,
  add column if not exists cash_received numeric(12, 2),
  add column if not exists change_amount numeric(12, 2);

create table if not exists public.payment_audit_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (
    action in (
      'PAYMENT_CREATED',
      'PAYMENT_CONFIRMED',
      'PAYMENT_REJECTED',
      'PAYMENT_CANCELLED',
      'EXCEPTION_APPROVED',
      'EXCEPTION_REJECTED'
    )
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_audit_events_restaurant_payment_created_idx
  on public.payment_audit_events (restaurant_id, payment_id, created_at desc);

create index if not exists payment_audit_events_restaurant_order_created_idx
  on public.payment_audit_events (restaurant_id, order_id, created_at desc);

alter table public.payment_audit_events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_audit_events'
      and policyname = 'members can read restaurant payment audit events'
  ) then
    create policy "members can read restaurant payment audit events"
      on public.payment_audit_events
      for select
      using (public.is_restaurant_member(restaurant_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_audit_events'
      and policyname = 'restaurant staff can insert payment audit events'
  ) then
    create policy "restaurant staff can insert payment audit events"
      on public.payment_audit_events
      for insert
      with check (
        public.is_restaurant_member(restaurant_id)
        and actor_user_id = auth.uid()
      );
  end if;
end
$$;

grant select, insert on public.payment_audit_events to authenticated;
