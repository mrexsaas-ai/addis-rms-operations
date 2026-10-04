-- ADDIS RMS V10: make menu images private and constrain every object operation by restaurant.
update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg']::text[]
where id = 'menu-images';

drop policy if exists "authenticated restaurant members can read menu images" on storage.objects;
create policy "authenticated restaurant members can read menu images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'menu-images'
    and exists (
      select 1
      from public.restaurant_users ru
      join public.restaurants r on r.id = ru.restaurant_id
      where ru.user_id = auth.uid()
        and ru.restaurant_id::text = (storage.foldername(name))[1]
        and r.status = 'ACTIVE'
    )
  );

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg']::text[]
where id = 'menu-images';

drop policy if exists "active restaurant managers can upload menu images" on storage.objects;
create policy "active restaurant managers can upload menu images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    and exists (
      select 1
      from public.restaurant_users ru
      join public.restaurants r on r.id = ru.restaurant_id
      where ru.user_id = auth.uid()
        and ru.restaurant_id::text = (storage.foldername(name))[1]
        and ru.role in ('ADMIN', 'OWNER', 'MANAGER')
        and r.status = 'ACTIVE'
    )
  );

drop policy if exists "active restaurant managers can update menu images" on storage.objects;
create policy "active restaurant managers can update menu images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'menu-images'
    and exists (
      select 1
      from public.restaurant_users ru
      join public.restaurants r on r.id = ru.restaurant_id
      where ru.user_id = auth.uid()
        and ru.restaurant_id::text = (storage.foldername(name))[1]
        and ru.role in ('ADMIN', 'OWNER', 'MANAGER')
        and r.status = 'ACTIVE'
    )
  )
  with check (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    and exists (
      select 1
      from public.restaurant_users ru
      join public.restaurants r on r.id = ru.restaurant_id
      where ru.user_id = auth.uid()
        and ru.restaurant_id::text = (storage.foldername(name))[1]
        and ru.role in ('ADMIN', 'OWNER', 'MANAGER')
        and r.status = 'ACTIVE'
    )
  );

drop policy if exists "active restaurant managers can delete menu images" on storage.objects;
create policy "active restaurant managers can delete menu images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'menu-images'
    and exists (
      select 1
      from public.restaurant_users ru
      join public.restaurants r on r.id = ru.restaurant_id
      where ru.user_id = auth.uid()
        and ru.restaurant_id::text = (storage.foldername(name))[1]
        and ru.role in ('ADMIN', 'OWNER', 'MANAGER')
        and r.status = 'ACTIVE'
    )
  );