-- Keep menu images private while evaluating reads through the existing
-- security-definer tenant membership check.
drop policy if exists "authenticated restaurant members can read menu images"
  on storage.objects;
drop policy if exists "active restaurant members can read menu images"
  on storage.objects;

create policy "active restaurant members can read menu images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'menu-images'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' then
        public.is_active_restaurant_member((storage.foldername(name))[1]::uuid)
      else false
    end
  );