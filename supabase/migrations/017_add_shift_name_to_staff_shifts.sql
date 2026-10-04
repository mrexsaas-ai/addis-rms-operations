alter table public.staff_shifts
  add column if not exists shift_name text;
do $$alter table public.staff_shifts
  add column if not exists clock_in_at timestamptz,
  add column if not exists clock_out_at timestamptz,
  add column if not exists late boolean not null default false;

