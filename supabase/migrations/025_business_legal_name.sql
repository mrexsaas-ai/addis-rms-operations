alter table public.restaurants
  add column if not exists business_legal_name text;

comment on column public.restaurants.business_legal_name is
  'Legal or registered business name, distinct from the public display name in name.';
