alter table public.payments
  add column if not exists confirmed_by uuid references auth.users(id) on delete set null,
  add column if not exists confirmed_at timestamptz;

create table if not exists public.payment_audit_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  actor_user_id uuid not null references auth.users(id) on delete set null,
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

create policy "members can read restaurant payment audit events"
  on public.payment_audit_events
  for select
  using (public.is_restaurant_member(restaurant_id));

create policy "restaurant staff can insert payment audit events"
  on public.payment_audit_events
  for insert
  with check (
    public.is_restaurant_member(restaurant_id)
    and actor_user_id = auth.uid()
  );

grant select, insert on public.payment_audit_events to authenticated;
