alter table public.payment_accounts
  add column if not exists verify_et_provider text;

update public.payment_accounts
set verify_et_provider = 'telebirr'
where type = 'TELEBIRR'
  and verify_et_provider is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.payment_accounts'::regclass
      and conname = 'payment_accounts_verify_et_provider_check'
  ) then
    alter table public.payment_accounts
      add constraint payment_accounts_verify_et_provider_check
      check (
        (type = 'TELEBIRR' and verify_et_provider = 'telebirr')
        or (
          type = 'BANK_TRANSFER'
          and (verify_et_provider is null or verify_et_provider in ('cbe', 'boa', 'dashen', 'awash', 'siinqee'))
        )
      );
  end if;
end
$$;

alter table public.payments
  add column if not exists verify_et_provider text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_verify_et_provider_check'
  ) then
    alter table public.payments
      add constraint payments_verify_et_provider_check
      check (
        verify_et_provider is null
        or (method = 'TELEBIRR' and verify_et_provider = 'telebirr')
        or (method = 'BANK_TRANSFER' and verify_et_provider in ('cbe', 'boa', 'dashen', 'awash', 'siinqee'))
      );
  end if;
end
$$;

alter table public.payment_audit_events
  drop constraint if exists payment_audit_events_action_check;

alter table public.payment_audit_events
  add constraint payment_audit_events_action_check
  check (
    action in (
      'PAYMENT_CREATED',
      'PAYMENT_CONFIRMED',
      'PAYMENT_REJECTED',
      'PAYMENT_CANCELLED',
      'PAYMENT_VERIFICATION_MISMATCH',
      'EXCEPTION_APPROVED',
      'EXCEPTION_REJECTED'
    )
  );

create or replace function public.create_pending_payment(p_order_id uuid, p_method text, p_account_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_restaurant_id uuid;
  v_method text := upper(trim(coalesce(p_method, '')));
  v_enabled_methods text[];
  v_order record;
  v_account record;
  v_existing_payment record;
  v_payment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  select restaurant_id into v_restaurant_id
  from public.restaurant_users
  where user_id = auth.uid()
  order by created_at asc
  limit 1;

  if not found or not public.has_restaurant_role(v_restaurant_id, array['ADMIN', 'OWNER', 'MANAGER', 'SERVER']) then
    raise exception 'Active restaurant service access is required.' using errcode = '42501';
  end if;

  if v_method not in ('TELEBIRR', 'BANK_TRANSFER') then
    raise exception 'Only configured Telebirr or bank transfer can be pending.' using errcode = '22023';
  end if;

  select enabled_payment_methods into v_enabled_methods
  from public.restaurant_settings
  where restaurant_id = v_restaurant_id;
  if not found then v_enabled_methods := array['CASH']; end if;
  if not exists (
    select 1 from unnest(v_enabled_methods) as enabled(method_name)
    where upper(trim(enabled.method_name)) = v_method
       or (v_method = 'BANK_TRANSFER' and upper(trim(enabled.method_name)) = 'CBE')
  ) then
    raise exception 'This payment method is not enabled.' using errcode = '23514';
  end if;

  select id, total, status into v_order
  from public.orders
  where id = p_order_id and restaurant_id = v_restaurant_id
  for update;
  if not found then raise exception 'Order not found in this restaurant.' using errcode = 'P0002'; end if;
  if v_order.status in ('CANCELLED', 'PAID') or v_order.total <= 0 then
    raise exception 'This order cannot accept a pending payment.' using errcode = '23514';
  end if;

  select id, account_number, type, verify_et_provider
    into v_account
  from public.payment_accounts
  where restaurant_id = v_restaurant_id
    and type = v_method
    and is_active = true
    and (p_account_id is null or id = p_account_id)
    and nullif(trim(account_number), '') is not null
  order by created_at desc
  limit 1;
  if not found then raise exception 'No active payment account is configured.' using errcode = '23514'; end if;
  if v_method = 'TELEBIRR' and v_account.verify_et_provider is distinct from 'telebirr' then
    raise exception 'Telebirr account provider identity is not configured.' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.payments
    where restaurant_id = v_restaurant_id and order_id = p_order_id and status = 'COMPLETED'
  ) then
    raise exception 'This order has already been paid.' using errcode = '23514';
  end if;

  select id, amount, verify_et_provider
    into v_existing_payment
  from public.payments
  where restaurant_id = v_restaurant_id
    and order_id = p_order_id
    and method = v_method
    and status = 'PENDING'
  limit 1;
  if found then
    return jsonb_build_object(
      'payment_id', v_existing_payment.id,
      'amount', v_existing_payment.amount,
      'created', false,
      'verify_et_provider', v_existing_payment.verify_et_provider
    );
  end if;

  insert into public.payments (
    restaurant_id, order_id, amount, method, status, received_by, verify_et_provider
  ) values (
    v_restaurant_id, p_order_id, v_order.total, v_method, 'PENDING', auth.uid(), v_account.verify_et_provider
  ) returning id into v_payment_id;

  insert into public.payment_audit_events (
    restaurant_id, payment_id, order_id, actor_user_id, action, metadata
  ) values (
    v_restaurant_id,
    v_payment_id,
    p_order_id,
    auth.uid(),
    'PAYMENT_CREATED',
    jsonb_build_object(
      'method', v_method,
      'account_id', v_account.id,
      'verify_et_provider', v_account.verify_et_provider,
      'status', 'PENDING'
    )
  );

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'amount', v_order.total,
    'created', true,
    'verify_et_provider', v_account.verify_et_provider
  );
end;
$$;

revoke all on function public.create_pending_payment(uuid, text, uuid) from public, anon;
grant execute on function public.create_pending_payment(uuid, text, uuid) to authenticated;

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
  v_provider_mismatch_reason text;
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
         p.reference_number, p.verify_et_provider, p.received_by,
         o.total as order_total, o.status as order_status
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

  if v_payment.verify_et_provider is null then
    v_provider_mismatch_reason := 'provider_identity_missing';
  elsif v_bank is distinct from v_payment.verify_et_provider then
    v_provider_mismatch_reason := 'provider_mismatch';
  elsif (v_payment.method = 'TELEBIRR' and v_payment.verify_et_provider <> 'telebirr')
     or (v_payment.method = 'BANK_TRANSFER' and v_payment.verify_et_provider not in ('cbe', 'boa', 'dashen', 'awash', 'siinqee'))
     or v_payment.method not in ('TELEBIRR', 'BANK_TRANSFER') then
    v_provider_mismatch_reason := 'provider_method_mismatch';
  end if;

  if v_provider_mismatch_reason is not null then
    insert into public.payment_audit_events (
      restaurant_id, payment_id, order_id, actor_user_id, action, metadata
    ) values (
      v_payment.restaurant_id,
      v_payment.id,
      v_payment.order_id,
      v_actor_user_id,
      'PAYMENT_VERIFICATION_MISMATCH',
      jsonb_build_object(
        'previous_status', 'PENDING',
        'new_status', 'PENDING',
        'actor_type', 'AUTOMATED_PROVIDER',
        'actor_source', 'VERIFY_ET',
        'verify_et_event_id', v_event_id,
        'verify_et_request_id', v_request_id,
        'expected_provider', v_payment.verify_et_provider,
        'received_provider', v_bank,
        'reason', v_provider_mismatch_reason,
        'changed_at', v_changed_at
      )
    )
    on conflict do nothing
    returning id into v_audit_id;

    if v_audit_id is null then
      return jsonb_build_object('outcome', 'duplicate', 'paymentId', v_payment.id);
    end if;

    return jsonb_build_object(
      'outcome', 'mismatch',
      'reason', v_provider_mismatch_reason,
      'paymentId', v_payment.id,
      'status', 'PENDING'
    );
  end if;

  if v_payment.amount <> p_amount then
    return jsonb_build_object('outcome', 'mismatch', 'reason', 'amount');
  end if;

  if v_payment.method = 'TELEBIRR' then
    if v_transaction_number is distinct from v_payment.reference_number then
      return jsonb_build_object('outcome', 'mismatch', 'reason', 'transaction_number');
    end if;
  elsif v_reference_number is distinct from v_payment.reference_number then
    return jsonb_build_object('outcome', 'mismatch', 'reason', 'reference_number');
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
  ) values (
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
      'verify_et_provider', v_payment.verify_et_provider,
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