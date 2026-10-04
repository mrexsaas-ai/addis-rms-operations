create or replace function public.process_verify_et_webhook_event(
  p_event_id text,
  p_request_id text,
  p_event_name text,
  p_event_timestamp timestamptz,
  p_processing_status text,
  p_status text,
  p_verified boolean,
  p_bank text,
  p_amount numeric,
  p_currency text,
  p_reference_number text default null,
  p_transaction_number text default null,
  p_receipt_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id text := nullif(trim(coalesce(p_event_id, '')), '');
  v_request_id text := nullif(trim(coalesce(p_request_id, '')), '');
  v_event_name text := lower(trim(coalesce(p_event_name, '')));
  v_processing_status text := lower(trim(coalesce(p_processing_status, '')));
  v_status text := lower(trim(coalesce(p_status, '')));
  v_bank text := lower(trim(coalesce(p_bank, '')));
  v_currency text := upper(trim(coalesce(p_currency, '')));
  v_reference_number text := nullif(trim(coalesce(p_reference_number, '')), '');
  v_transaction_number text := nullif(trim(coalesce(p_transaction_number, '')), '');
  v_receipt_number text := nullif(trim(coalesce(p_receipt_number, '')), '');
  v_payment record;
  v_decision text;
  v_audit_id uuid;
  v_existing_payment_id uuid;
  v_actor_user_id uuid;
  v_item_total numeric(12, 2);
  v_item_count bigint;
  v_changed_at timestamptz := now();
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Verify.et webhook processing requires the service role.' using errcode = '42501';
  end if;

  if v_event_id is null or v_request_id is null or v_event_timestamp is null
     or v_event_name <> 'verification.completed'
     or v_processing_status not in ('completed', 'failed')
     or v_status = '' or p_verified is null or v_bank = ''
     or p_amount is null or p_amount <= 0 or p_amount::text = 'NaN'
     or v_currency = '' then
    raise exception 'Verify.et webhook fields are invalid.' using errcode = '22023';
  end if;

  if v_currency <> 'ETB' then
    return jsonb_build_object('outcome', 'mismatch', 'reason', 'currency');
  end if;

  if p_verified and v_status = 'success' and v_processing_status = 'completed' then
    v_decision := 'COMPLETED';
  elsif not p_verified and v_status in ('failed', 'not_found') then
    v_decision := 'FAILED';
  else
    return jsonb_build_object('outcome', 'ignored', 'reason', 'non_terminal_result');
  end if;

  select p.id, p.restaurant_id, p.order_id, p.amount, p.method, p.status,
         p.reference_number, p.received_by, o.total as order_total, o.status as order_status
    into v_payment
  from public.payments p
  join public.orders o on o.id = p.order_id and o.restaurant_id = p.restaurant_id
  join public.restaurants r on r.id = p.restaurant_id
  where p.verify_et_request_id = v_request_id
  for update of p, o;

  if not found then
    raise exception 'No payment matches this Verify.et request ID.' using errcode = 'P0002';
  end if;

  select payment_id
    into v_existing_payment_id
  from public.payment_audit_events
  where metadata ->> 'verify_et_event_id' = v_event_id
  limit 1;

  if found then
    if v_existing_payment_id = v_payment.id then
      return jsonb_build_object('outcome', 'duplicate', 'paymentId', v_payment.id);
    end if;
    return jsonb_build_object('outcome', 'mismatch', 'reason', 'event_id_conflict');
  end if;

  if v_payment.status <> 'PENDING' then
    return jsonb_build_object('outcome', 'ignored', 'reason', 'payment_not_pending');
  end if;

  if (v_payment.method = 'TELEBIRR' and v_bank <> 'telebirr')
     or (v_payment.method = 'BANK_TRANSFER' and v_bank not in ('cbe', 'boa', 'dashen', 'awash', 'siinqee'))
     or v_payment.method not in ('TELEBIRR', 'BANK_TRANSFER') then
    return jsonb_build_object('outcome', 'mismatch', 'reason', 'bank_method');
  end if;

  if v_payment.amount <> p_amount then
    return jsonb_build_object('outcome', 'mismatch', 'reason', 'amount');
  end if;

  if v_payment.method = 'TELEBIRR' then
    if v_transaction_number is distinct from v_payment.reference_number then
      return jsonb_build_object('outcome', 'mismatch', 'reason', 'transaction_number');
    end if;
  elsif v_bank = 'cbe' then
    if v_payment.reference_number is distinct from v_reference_number
       and v_payment.reference_number is distinct from v_receipt_number then
      return jsonb_build_object('outcome', 'mismatch', 'reason', 'cbe_reference');
    end if;
  elsif v_reference_number is distinct from v_payment.reference_number then
    return jsonb_build_object('outcome', 'mismatch', 'reason', 'reference_number');
  end if;

  select actor_user_id
    into v_actor_user_id
  from public.payment_audit_events
  where restaurant_id = v_payment.restaurant_id
    and payment_id = v_payment.id
    and action = 'PAYMENT_CREATED'
  order by created_at asc
  limit 1;

  if not found or v_actor_user_id is null then
    v_actor_user_id := v_payment.received_by;
  end if;

  if v_actor_user_id is null then
    raise exception 'The originating payment actor could not be resolved for the audit event.' using errcode = '23514';
  end if;

  if v_decision = 'COMPLETED' then
    if v_payment.order_status in ('CANCELLED', 'PAID') or v_payment.amount <> v_payment.order_total then
      return jsonb_build_object('outcome', 'mismatch', 'reason', 'order_total');
    end if;

    select count(*), coalesce(sum(subtotal), 0)
      into v_item_count, v_item_total
    from public.order_items
    where order_id = v_payment.order_id
      and restaurant_id = v_payment.restaurant_id;

    if v_item_count = 0 or v_item_total <> v_payment.order_total then
      return jsonb_build_object('outcome', 'mismatch', 'reason', 'order_items');
    end if;

    if exists (
      select 1 from public.payments
      where restaurant_id = v_payment.restaurant_id
        and order_id = v_payment.order_id
        and status = 'COMPLETED'
        and id <> v_payment.id
    ) then
      return jsonb_build_object('outcome', 'mismatch', 'reason', 'another_payment_completed');
    end if;
  end if;

  insert into public.payment_audit_events (
    restaurant_id, payment_id, order_id, actor_user_id, action, metadata
  )
  values (
    v_payment.restaurant_id,
    v_payment.id,
    v_payment.order_id,
    v_actor_user_id,
    case when v_decision = 'COMPLETED' then 'PAYMENT_CONFIRMED' else 'PAYMENT_REJECTED' end,
    jsonb_build_object(
      'previous_status', 'PENDING',
      'new_status', v_decision,
      'actor_type', 'AUTOMATED_PROVIDER',
      'actor_source', 'VERIFY_ET',
      'initiated_by_user_id', v_actor_user_id,
      'verify_et_event_id', v_event_id,
      'verify_et_request_id', v_request_id,
      'event', v_event_name,
      'event_timestamp', p_event_timestamp,
      'processing_status', v_processing_status,
      'status', v_status,
      'verified', p_verified,
      'bank', v_bank,
      'amount', p_amount,
      'currency', v_currency,
      'reference_number', v_reference_number,
      'transaction_number', v_transaction_number,
      'receipt_number', v_receipt_number,
      'changed_at', v_changed_at
    )
  )
  on conflict do nothing
  returning id into v_audit_id;

  if v_audit_id is null then
    return jsonb_build_object('outcome', 'duplicate', 'paymentId', v_payment.id);
  end if;

  update public.payments
  set status = v_decision,
      confirmed_at = case when v_decision = 'COMPLETED' then v_changed_at else confirmed_at end
  where id = v_payment.id
    and restaurant_id = v_payment.restaurant_id
    and order_id = v_payment.order_id
    and status = 'PENDING';

  if not found then
    raise exception 'Pending payment changed before webhook processing.' using errcode = '40001';
  end if;

  if v_decision = 'COMPLETED' then
    update public.orders
    set status = 'PAID', updated_at = v_changed_at
    where id = v_payment.order_id
      and restaurant_id = v_payment.restaurant_id
      and status not in ('CANCELLED', 'PAID');

    if not found then
      raise exception 'Order changed before webhook processing.' using errcode = '40001';
    end if;
  end if;

  return jsonb_build_object(
    'outcome', 'processed',
    'paymentId', v_payment.id,
    'orderId', v_payment.order_id,
    'status', v_decision
  );
end;
$$;

revoke all on function public.process_verify_et_webhook_event(
  text, text, text, timestamptz, text, text, boolean, text, numeric, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.process_verify_et_webhook_event(
  text, text, text, timestamptz, text, text, boolean, text, numeric, text, text, text, text
) to service_role;

notify pgrst, 'reload schema';