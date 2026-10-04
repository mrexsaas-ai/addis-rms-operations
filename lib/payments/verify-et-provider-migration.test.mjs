import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../supabase/migrations/041_verify_et_provider_binding.sql", import.meta.url),
  "utf8",
);
const priorResolutionMigration = readFileSync(
  new URL("../../supabase/migrations/037_allow_server_pending_payment_resolution.sql", import.meta.url),
  "utf8",
);

test("pending payment creation snapshots only the configured provider", () => {
  assert.match(migration, /add column if not exists verify_et_provider text/i);
  assert.match(migration, /update public\.payment_accounts\s+set verify_et_provider = 'telebirr'[\s\S]*?where type = 'TELEBIRR'/i);
  assert.match(migration, /'PENDING', auth\.uid\(\), v_account\.verify_et_provider/i);
  assert.match(migration, /'verify_et_provider', v_account\.verify_et_provider/i);
  assert.match(migration, /from public\.payment_accounts[\s\S]*?where restaurant_id = v_restaurant_id/i);
});

test("webhook matches the stored request, provider, method, reference, amount and ETB currency", () => {
  assert.match(migration, /where p\.verify_et_request_id = v_request_id\s+for update of p, o/i);
  assert.match(migration, /if v_payment\.status <> 'PENDING' then/i);
  assert.match(migration, /v_payment\.verify_et_provider is null/i);
  assert.match(migration, /v_bank is distinct from v_payment\.verify_et_provider/i);
  assert.match(migration, /v_transaction_number is distinct from v_payment\.reference_number/i);
  assert.match(migration, /v_reference_number is distinct from v_payment\.reference_number/i);
  assert.match(migration, /if v_payment\.amount <> p_amount then/i);
  assert.match(migration, /if v_currency <> 'ETB' then/i);
  assert.match(migration, /p_verified and v_status = 'success' and v_processing_status = 'completed'/i);
});

test("provider mismatches are audited without completing or failing the payment", () => {
  assert.match(migration, /'PAYMENT_VERIFICATION_MISMATCH'/i);
  assert.match(migration, /'new_status', 'PENDING'/i);
  assert.match(migration, /'expected_provider', v_payment\.verify_et_provider/i);
  assert.match(migration, /'received_provider', v_bank/i);
  assert.match(migration, /'status', 'PENDING'/i);
});

test("event ID deduplication and the existing manual resolver remain intact", () => {
  assert.match(migration, /metadata ->> 'verify_et_event_id' = v_event_id/i);
  assert.match(migration, /on conflict do nothing/i);
  assert.match(migration, /grant execute on function public\.process_verify_et_webhook_event[\s\S]*?to service_role/i);
  assert.doesNotMatch(migration, /create or replace function public\.resolve_pending_payment/i);
  assert.match(priorResolutionMigration, /create or replace function public\.resolve_pending_payment/i);
});