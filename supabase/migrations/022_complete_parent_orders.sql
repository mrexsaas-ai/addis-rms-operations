-- Keep order preparation status independent from payment status.

create or replace function public.sync_parent_order_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pending_count integer;
begin
  if new.status <> 'COMPLETED' or old.status = new.status then
    return new;
  end if;

  select count(*) into pending_count
  from public.kitchen_orders
  where order_id = new.order_id
    and restaurant_id = new.restaurant_id
    and status <> 'COMPLETED';

  if pending_count = 0 then
    update public.orders
    set status = 'COMPLETED', updated_at = now()
    where id = new.order_id
      and restaurant_id = new.restaurant_id
      and status not in ('CANCELLED', 'PAID');
  end if;

  return new;
end;
$$;

drop trigger if exists sync_parent_order_completion on public.kitchen_orders;
create trigger sync_parent_order_completion
after update of status on public.kitchen_orders
for each row
execute function public.sync_parent_order_completion();

revoke execute on function public.sync_parent_order_completion() from public;
