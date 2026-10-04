-- Allow active restaurant servers to complete pending payments in their tenant.
create or replace function public.resolve_pending_payment(p_payment_id uuid, p_decision text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_restaurant_id uuid;
  v_payment record;
  v_item_total numeric(12,2);
  v_item_count bigint;
  v_decision text := upper(trim(coalesce(p_decision, '')));
  v_changed_at timestamptz := now();
  v_reference text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  select restaurant_id
    into v_restaurant_id
  from public.restaurant_users
  where user_id = auth.uid()
  order by created_at asc
  limit 1;

  if not found or not public.has_restaurant_role(v_restaurant_id, array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']) then
    raise exception 'Active restaurant management access is required.' using errcode = '42501';
  end if;

  if v_decision not in ('COMPLETED', 'FAILED') then
    raise exception 'Payment decision must be COMPLETED or FAILED.' using errcode = '22023';
  end if;

  select p.id, p.restaurant_id, p.order_id, p.amount, p.method, p.status, p.reference_number,
         o.total as order_total, o.status as order_status
    into v_payment
  from public.payments p
  join public.orders o on o.id = p.order_id and o.restaurant_id = p.restaurant_id
  where p.id = p_payment_id and p.restaurant_id = v_restaurant_id
  for update of p, o;

  if not found then
    raise exception 'Payment was not found in this restaurant.' using errcode = 'P0002';
  end if;

  if v_payment.status <> 'PENDING' or v_payment.amount <= 0 then
    raise exception 'Payment is not pending verification.' using errcode = '23514';
  end if;

  if v_decision = 'COMPLETED' and v_payment.method <> 'CASH' and nullif(trim(p_note), '') is null then
    raise exception 'A transaction reference is required for this payment method.' using errcode = '23514';
  end if;

  if v_decision = 'COMPLETED' then
    if v_payment.order_status in ('CANCELLED', 'PAID') or v_payment.amount <> v_payment.order_total then
      raise exception 'Pending payment no longer matches a payable order.' using errcode = '23514';
    end if;

    select count(*), coalesce(sum(subtotal), 0)
      into v_item_count, v_item_total
    from public.order_items
    where order_id = v_payment.order_id and restaurant_id = v_restaurant_id;

    if v_item_count = 0 or v_item_total <> v_payment.order_total then
      raise exception 'Order lines do not match the order total.' using errcode = '23514';
    end if;
  end if;

  v_reference := coalesce(nullif(trim(p_note), ''), v_payment.reference_number);

  update public.payments
  set status = v_decision,
      reference_number = v_reference,
      confirmed_by = case when v_decision = 'COMPLETED' then auth.uid() else confirmed_by end,
      confirmed_at = case when v_decision = 'COMPLETED' then v_changed_at else confirmed_at end
  where id = v_payment.id and restaurant_id = v_restaurant_id and status = 'PENDING';

  if v_decision = 'COMPLETED' then
    update public.orders
    set status = 'PAID', updated_at = v_changed_at
    where id = v_payment.order_id and restaurant_id = v_restaurant_id;
  end if;

  insert into public.payment_audit_events (restaurant_id, payment_id, order_id, actor_user_id, action, metadata)
  values (
    v_restaurant_id,
    v_payment.id,
    v_payment.order_id,
    auth.uid(),
    case when v_decision = 'COMPLETED' then 'PAYMENT_CONFIRMED' else 'PAYMENT_REJECTED' end,
    jsonb_build_object(
      'previous_status', 'PENDING',
      'new_status', v_decision,
      'note', nullif(trim(p_note), ''),
      'changed_at', v_changed_at
    )
  );

  return jsonb_build_object(
    'paymentId', v_payment.id,
    'orderId', v_payment.order_id,
    'status', v_decision,
    'message', case
      when v_decision = 'COMPLETED' then 'Payment confirmed successfully.'
      else 'Payment rejected and placed in failed status.'
    end
  );
end;
$$;

revoke all on function public.resolve_pending_payment(uuid, text, text) from public, anon;
grant execute on function public.resolve_pending_payment(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';