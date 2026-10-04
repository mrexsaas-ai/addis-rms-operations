-- Persist current staff duty state on the restaurant membership.
-- Scheduled shift history remains in public.staff_shifts and is not modified.

alter table public.restaurant_users
  add column if not exists duty_status text not null default 'OFF_DUTY';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_users'::regclass
      and conname = 'restaurant_users_duty_status_check'
  ) then
    alter table public.restaurant_users
      add constraint restaurant_users_duty_status_check
      check (duty_status in ('ON_DUTY', 'OFF_DUTY'));
  end if;
end
$$;
