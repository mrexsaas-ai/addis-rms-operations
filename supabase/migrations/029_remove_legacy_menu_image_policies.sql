-- Remove legacy broad menu-image write policies after tenant-scoped policies are in place.
drop policy if exists "Menu image managers can delete" on storage.objects;
drop policy if exists "Menu image managers can update" on storage.objects;
drop policy if exists "Menu image managers can upload" on storage.objects;
