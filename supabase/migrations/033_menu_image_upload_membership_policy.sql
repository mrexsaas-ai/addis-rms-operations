drop policy if exists "active restaurant managers can upload menu images"
  on storage.objects;

create policy "active restaurant managers can upload menu images"
  on storage.objects for insert to authenticated
  with check (
    case
      when bucket_id = 'menu-images'
        and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_restaurant_role(
        (storage.foldername(name))[1]::uuid,
        array['ADMIN', 'OWNER', 'MANAGER']
      )
      else false
    end
  );
