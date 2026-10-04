-- Minimal 7-day trial state on the existing restaurants model.
-- Legacy restaurants retain null trial dates; new restaurants use the defaults.

alter table public.restaurants
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists trial_status text;

alter table public.restaurants
  alter column trial_started_at set default now(),
  alter column trial_ends_at set default (now() + interval '7 days'),
  alter column trial_status set default 'ACTIVE';

update public.restaurants
set trial_status = 'ACTIVE'
where trial_status is null;

alter table public.restaurants
  alter column trial_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_trial_status_check'
  ) then
    alter table public.restaurants
      add constraint restaurants_trial_status_check
      check (trial_status in ('ACTIVE', 'EXPIRED'));
  end if;
end
$$;

create index if not exists restaurants_trial_status_idx
  on public.restaurants (trial_status, trial_ends_at);
