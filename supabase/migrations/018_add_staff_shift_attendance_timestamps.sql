alter table public.staff_shifts
  add column if not exists clock_in_at timestamptz,
  add column if not exists clock_out_at timestamptz,
  add column if not exists late boolean not null default false;

update public.staff_shifts
set late = false
where late is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.staff_shifts'::regclass
      and conname = 'staff_shifts_clock_out_after_clock_in_check'
  ) then
    alter table public.staff_shifts
      add constraint staff_shifts_clock_out_after_clock_in_check
      check (clock_out_at is null or clock_in_at is null or clock_out_at >= clock_in_at);
  end if;
end
$$;