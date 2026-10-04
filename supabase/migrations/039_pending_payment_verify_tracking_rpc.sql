create or replace function public.set_pending_payment_verify_tracking(
  p_payment_id uuid,
  p_reference_number text,
  p_verify_et_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_restaurant_id uuid;
  v_payment record;
  v_reference_number text := nullif(trim(coalesce(p_reference_number, '')), '');
  v_request_id text := nullif(trim(coalesce(p_verify_et_request_id, '')), '');
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
    raise exception 'Active restaurant service access is required.' using errcode = '42501';
  end if;

  if v_reference_number is null then
    raise exception 'A transaction reference is required.' using errcode = '22023';
  end if;

  select id, restaurant_id, status, method, reference_number, verify_et_request_id
    into v_payment
  from public.payments
  where id = p_payment_id
    and restaurant_id = v_restaurant_id
  for update;

  if not found then
    raise exception 'Payment was not found in this restaurant.' using errcode = 'P0002';
  end if;

  if v_payment.status <> 'PENDING' or v_payment.method not in ('TELEBIRR', 'BANK_TRANSFER') then
    raise exception 'Only pending bank and Telebirr payments can be submitted for verification.' using errcode = '23514';
  end if;

  if v_payment.reference_number is not null and v_payment.reference_number <> v_reference_number then
    raise exception 'A different transaction reference is already associated with this pending payment.' using errcode = '23514';
  end if;

  if v_payment.verify_et_request_id is not null
     and v_request_id is not null
     and v_payment.verify_et_request_id <> v_request_id then
    raise exception 'A different Verify.et request ID is already associated with this payment.' using errcode = '23514';
  end if;

  update public.payments
  set reference_number = v_reference_number,
      verify_et_request_id = coalesce(v_request_id, verify_et_request_id)
  where id = v_payment.id
    and restaurant_id = v_restaurant_id
    and status = 'PENDING';

  return jsonb_build_object(
    'paymentId', v_payment.id,
    'referenceNumber', v_reference_number,
    'requestId', coalesce(v_request_id, v_payment.verify_et_request_id)
  );
end;
$$;

revoke all on function public.set_pending_payment_verify_tracking(uuid, text, text) from public, anon;
grant execute on function public.set_pending_payment_verify_tracking(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';