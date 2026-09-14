-- Settings needs an optional branch label for bank accounts.
alter table public.payment_accounts
  add column if not exists branch text;
