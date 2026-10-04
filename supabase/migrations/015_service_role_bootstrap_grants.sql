-- Allow trusted server-side bootstrap actions to inspect and connect existing records.
-- This does not grant access to anon/authenticated clients or alter RLS policies.
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.restaurant_users to service_role;
grant select, insert, update, delete on public.restaurants to service_role;
