create or replace function public.create_order_atomic(
  p_order_type text,
  p_order_number_prefix text,
  p_creation_flow text,
  p_table_id uuid,
  p_notes text,
  p_item_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_restaurant_id uuid;
  v_membership_count integer;
  v_order_type text := upper(trim(coalesce(p_order_type, '')));
  v_order_number_prefix text := upper(trim(coalesce(p_order_number_prefix, '')));
  v_creation_flow text := upper(trim(coalesce(p_creation_flow, '')));
  v_item_ids uuid[] := array[]::uuid[];
  v_quantities integer[] := array[]::integer[];
  v_item_ids_seen uuid[] := array[]::uuid[];
  v_item jsonb;
  v_item_id uuid;
  v_item_id_text text;
  v_quantity numeric;
  v_item_index integer;
  v_menu_item record;
  v_menu_item_count integer := 0;
  v_subtotal numeric(12, 2) := 0;
  v_table record;
  v_existing_order record;
  v_order_id uuid;
  v_order_number text;
  v_order_total numeric(12, 2);
  v_updated_order_count integer;
  v_order_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_item_notes text := nullif(trim(coalesce(p_item_notes, '')), '');
  v_created_at timestamptz := clock_timestamp();
begin
  if v_user_id is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  select count(*)
    into v_membership_count
  from public.restaurant_users
  where user_id = v_user_id;

  if v_membership_count <> 1 then
    raise exception 'A single active restaurant membership is required.' using errcode = '42501';
  end if;

  select restaurant_id
    into v_restaurant_id
  from public.restaurant_users
  where user_id = v_user_id;

  if not public.has_restaurant_role(v_restaurant_id, array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']) then
    raise exception 'You do not have permission to create orders.' using errcode = '42501';
  end if;

  if v_order_type is null or v_order_type not in ('DINE_IN', 'TAKEAWAY', 'DELIVERY') then
    raise exception 'Choose a valid order type.' using errcode = '22023';
  end if;
  if v_order_number_prefix not in ('POS', 'ORD') then
    raise exception 'Order number prefix is invalid.' using errcode = '22023';
  end if;
  if v_creation_flow not in ('SERVER_POS', 'ORDERS_PAGE') then
    raise exception 'Order creation flow is invalid.' using errcode = '22023';
  end if;

  if v_order_type = 'DINE_IN' and p_table_id is null then
    raise exception 'Select a table for dine-in orders.' using errcode = '22023';
  end if;
  if v_order_type <> 'DINE_IN' and p_table_id is not null then
    raise exception 'Only dine-in orders can use a table.' using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item to the cart.' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Invalid cart payload.' using errcode = '22023';
    end if;

    v_item_id_text := nullif(trim(v_item ->> 'id'), '');
    begin
      v_item_id := v_item_id_text::uuid;
      v_quantity := (v_item ->> 'quantity')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Cart item ID and quantity must be valid.' using errcode = '22023';
    end;

    if v_item_id is null or v_quantity is null or v_quantity::text = 'NaN'
       or v_quantity <= 0 or v_quantity <> trunc(v_quantity) or v_quantity > 2147483647 then
      raise exception 'Cart item quantity must be a positive whole number.' using errcode = '22023';
    end if;
    if v_item_id = any(v_item_ids_seen) then
      raise exception 'Cart item IDs must be unique.' using errcode = '22023';
    end if;

    v_item_ids := array_append(v_item_ids, v_item_id);
    v_quantities := array_append(v_quantities, v_quantity::integer);
    v_item_ids_seen := array_append(v_item_ids_seen, v_item_id);
  end loop;

  if v_order_type = 'DINE_IN' then
    select id, status
      into v_table
    from public.tables
    where id = p_table_id
      and restaurant_id = v_restaurant_id
    for update;

    if not found then
      raise exception 'That table does not belong to this restaurant.' using errcode = 'P0002';
    end if;

    if v_creation_flow = 'SERVER_POS' then
      select o.id, o.order_number, o.total
        into v_existing_order
      from public.orders o
      where o.id in (
        select recent.id
        from public.orders recent
        where recent.restaurant_id = v_restaurant_id
          and recent.table_id = p_table_id
          and recent.status <> 'CANCELLED'
        order by recent.created_at desc
        limit 20
      )
        and not exists (
          select 1 from public.payments p
          where p.restaurant_id = v_restaurant_id
            and p.order_id = o.id
            and p.status = 'COMPLETED'
        )
        and o.restaurant_id = v_restaurant_id
        and o.table_id = p_table_id
        and o.status <> 'CANCELLED'
      order by o.created_at desc
      limit 1
      for update;

      if found then
        return jsonb_build_object(
          'success', true,
          'existing_order', true,
          'order_id', v_existing_order.id,
          'order_number', v_existing_order.order_number,
          'order_total', v_existing_order.total
        );
      end if;
    end if;

    if v_table.status not in ('AVAILABLE', 'RESERVED') then
      raise exception 'Only available or reserved tables can be used for a new dine-in order.' using errcode = '23514';
    end if;
  end if;

  for v_menu_item in
    select id, name, price, station
    from public.menu_items
    where restaurant_id = v_restaurant_id
      and id = any(v_item_ids)
      and is_available = true
    order by id
    for share
  loop
    v_menu_item_count := v_menu_item_count + 1;
    if v_menu_item.station not in ('KITCHEN', 'BAR') then
      raise exception 'Menu item "%" has an invalid station.', v_menu_item.name using errcode = '23514';
    end if;
    if v_menu_item.price is null or v_menu_item.price < 0 or v_menu_item.price::text = 'NaN' then
      raise exception 'Menu item "%" has an invalid price.', v_menu_item.name using errcode = '23514';
    end if;
    v_item_index := array_position(v_item_ids, v_menu_item.id);
    v_subtotal := v_subtotal + (v_menu_item.price * v_quantities[v_item_index]);
  end loop;

  if v_menu_item_count <> cardinality(v_item_ids) then
    raise exception 'One or more menu items are unavailable in this restaurant.' using errcode = 'P0002';
  end if;
  if v_subtotal is null or v_subtotal < 0 or v_subtotal::text = 'NaN' then
    raise exception 'The order total is invalid.' using errcode = '23514';
  end if;
  if v_subtotal = 0 and v_creation_flow = 'SERVER_POS' then
    raise exception 'The order total must be greater than zero.' using errcode = '23514';
  end if;

  v_order_number := v_order_number_prefix || '-' || upper(replace(gen_random_uuid()::text, '-', ''));

  insert into public.orders (
    restaurant_id, table_id, created_by, order_number, subtotal, total, notes, status
  ) values (
    v_restaurant_id,
    case when v_order_type = 'DINE_IN' then p_table_id else null end,
    v_user_id,
    v_order_number,
    0,
    0,
    v_order_notes,
    'NEW'
  ) returning id into v_order_id;

  insert into public.order_items (
    restaurant_id, order_id, menu_item_id, quantity, unit_price, subtotal, notes
  )
  select
    v_restaurant_id,
    v_order_id,
    m.id,
    cart.quantity,
    m.price,
    m.price * cart.quantity,
    v_item_notes
  from unnest(v_item_ids, v_quantities) as cart(menu_item_id, quantity)
  join public.menu_items m
    on m.id = cart.menu_item_id
   and m.restaurant_id = v_restaurant_id
   and m.is_available = true
  order by m.id;

  if not found then
    raise exception 'Order items could not be created.' using errcode = '23514';
  end if;

  update public.orders o
  set subtotal = totals.order_total,
      total = totals.order_total,
      updated_at = now()
  from (
    select coalesce(sum(oi.subtotal), 0) as order_total
    from public.order_items oi
    where oi.order_id = v_order_id
      and oi.restaurant_id = v_restaurant_id
  ) totals
  where o.id = v_order_id
    and o.restaurant_id = v_restaurant_id;

  get diagnostics v_updated_order_count = row_count;
  if v_updated_order_count <> 1 then
    raise exception 'The created order could not be updated with its item total.' using errcode = '23514';
  end if;

  insert into public.kitchen_orders (restaurant_id, order_id, station, status, updated_at)
  select distinct v_restaurant_id, v_order_id, m.station, 'NEW', v_created_at
  from public.order_items oi
  join public.menu_items m
    on m.id = oi.menu_item_id
   and m.restaurant_id = oi.restaurant_id
  where oi.order_id = v_order_id
    and oi.restaurant_id = v_restaurant_id
  on conflict (order_id, station) do nothing;

  if v_order_type = 'DINE_IN' then
    update public.tables
    set status = 'OCCUPIED', updated_at = v_created_at
    where id = p_table_id
      and restaurant_id = v_restaurant_id
      and (v_creation_flow <> 'SERVER_POS' or status in ('AVAILABLE', 'RESERVED'));

    if not found then
      raise exception 'The selected table could not be marked occupied.' using errcode = '23514';
    end if;
  end if;

  select total into v_order_total
  from public.orders
  where id = v_order_id and restaurant_id = v_restaurant_id;

  return jsonb_build_object(
    'success', true,
    'existing_order', false,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'order_total', v_order_total
  );
end;
$$;

revoke all on function public.create_order_atomic(text, text, text, uuid, text, text, jsonb) from public, anon;
grant execute on function public.create_order_atomic(text, text, text, uuid, text, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
