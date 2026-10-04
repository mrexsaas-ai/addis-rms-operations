alter table public.payments
  add column if not exists verify_et_request_id text;

create unique index if not exists payments_verify_et_request_id_uidx
  on public.payments (verify_et_request_id)
  where verify_et_request_id is not null;

create unique index if not exists payment_audit_events_verify_et_event_id_uidx
  on public.payment_audit_events ((metadata ->> 'verify_et_event_id'))
  where (metadata ->> 'verify_et_event_id') is not null;