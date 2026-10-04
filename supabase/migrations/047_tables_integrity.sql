create or replace function public.enforce_table_update_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_is_manager boolean;
  v_is_server boolean;
begin
  if new.id is distinct from old.id
     or new.restaurant_id is distinct from old.restaurant_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Table identity, tenant, and creation time cannot be changed.' using errcode = '42501';
  end if;

  -- SECURITY DEFINER RPCs run as their owner and retain their own authorization checks.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if v_actor_user_id is null then
    raise exception 'You must be signed in to update a table.' using errcode = '42501';
  end if;

  v_is_manager := public.has_restaurant_role(
    old.restaurant_id,
    array['ADMIN', 'OWNER', 'MANAGER']
  );
  if v_is_manager then
    return new;
  end if;

  v_is_server := public.has_restaurant_role(old.restaurant_id, array['SERVER']);
  if not v_is_server then
    raise exception 'You do not have permission to update this table.' using errcode = '42501';
  end if;

  if new.table_number is distinct from old.table_number
     or new.name is distinct from old.name
     or new.capacity is distinct from old.capacity then
    raise exception 'Servers cannot edit table details.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status
     and not (
       (old.status = 'AVAILABLE' and new.status = 'CLEANING')
       or (old.status = 'OCCUPIED' and new.status = 'AVAILABLE')
       or (old.status = 'CLEANING' and new.status = 'AVAILABLE')
     ) then
    raise exception 'Servers cannot make this table status transition.' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_table_update_integrity() from public, anon, authenticated;

drop trigger if exists enforce_table_update_integrity on public.tables;
create trigger enforce_table_update_integrity
before update on public.tables
for each row
execute function public.enforce_table_update_integrity();