import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../supabase/migrations/044_payment_attempt_guardrails.sql", import.meta.url),
  "utf8",
);
const paymentSchema = readFileSync(
  new URL("../../supabase/migrations/001_initial_schema.sql", import.meta.url),
  "utf8",
);
const paymentAction = readFileSync(new URL("../../app/orders/actions.js", import.meta.url), "utf8");
const serverPos = readFileSync(new URL("../../app/server/ServerPOSClient.js", import.meta.url), "utf8");
const ordersView = readFileSync(new URL("../../app/orders/OrdersView.js", import.meta.url), "utf8");
const languageProvider = readFileSync(new URL("../../app/i18n/LanguageProvider.js", import.meta.url), "utf8");

function getFunction(name) {
  const start = migration.toLowerCase().indexOf(`create or replace function public.${name.toLowerCase()}`);
  assert.notEqual(start, -1, `Migration must replace ${name}.`);
  const end = migration.indexOf("\n$$;", start);
  assert.notEqual(end, -1, `${name} function must be terminated.`);
  return migration.slice(start, end + 4);
}

test("SERVER can manually complete pending payments but cannot fail them", () => {
  const resolver = getFunction("resolve_pending_payment");
  const completedStart = resolver.indexOf("IF v_decision = 'COMPLETED' THEN");
  const failedBranchStart = resolver.indexOf("ELSIF NOT public.has_restaurant_role", completedStart);
  const failedBranchEnd = resolver.indexOf("END IF;", failedBranchStart);
  const completedBranch = resolver.slice(completedStart, failedBranchStart);
  const failedBranch = resolver.slice(failedBranchStart, failedBranchEnd);

  assert.match(completedBranch, /array\['ADMIN', 'OWNER', 'MANAGER', 'SERVER'\]/);
  assert.doesNotMatch(completedBranch, /'CHEF'|'BARMAN'/);
  assert.match(failedBranch, /array\['ADMIN', 'OWNER', 'MANAGER'\]/);
  assert.doesNotMatch(failedBranch, /'SERVER'|'CHEF'|'BARMAN'/);
  assert.match(resolver, /FOR UPDATE OF p, o/i);
  assert.match(resolver, /INSERT INTO public\.payment_audit_events/i);
  assert.match(resolver, /UPDATE public\.orders[\s\S]*?SET status = 'PAID'/i);
});

test("only PENDING is unique per restaurant order and existing rows are not deleted", () => {
  assert.match(paymentSchema, /status text not null default 'PENDING' check \(status in \('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'\)\)/i);
  assert.match(migration, /GROUP BY restaurant_id, order_id\s+HAVING count\(\*\) > 1/i);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS payments_one_pending_per_order_uidx\s+ON public\.payments \(restaurant_id, order_id\)\s+WHERE status = 'PENDING'/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM\s+public\.payments/i);
});

test("pending RPC reuses same-method retries and rejects a different active method", () => {
  const createPending = getFunction("create_pending_payment");

  assert.match(createPending, /WHERE id = p_order_id AND restaurant_id = v_restaurant_id\s+FOR UPDATE/i);
  assert.match(createPending, /WHERE restaurant_id = v_restaurant_id\s+AND order_id = p_order_id\s+AND status = 'PENDING'/i);
  assert.match(createPending, /IF v_existing_payment\.method <> v_method THEN\s+RAISE EXCEPTION 'An active payment already exists for this order\.'/i);
  assert.match(createPending, /'created', false/);
  assert.match(createPending, /INSERT INTO public\.payment_audit_events[\s\S]*?'PAYMENT_CREATED'/i);
  assert.match(createPending, /status = 'COMPLETED'/i);
  assert.doesNotMatch(createPending, /status = 'FAILED'/i);
  assert.match(migration, /ON public\.payments \(restaurant_id, order_id\)\s+WHERE status = 'PENDING'/i);
});

test("completed payment RPC rejects cash or manual payment while an attempt is pending", () => {
  const recordCompleted = getFunction("record_completed_payment");

  assert.match(recordCompleted, /WHERE id = p_order_id AND restaurant_id = v_restaurant_id FOR UPDATE/i);
  assert.match(recordCompleted, /WHERE restaurant_id = v_restaurant_id AND order_id = p_order_id AND status = 'PENDING'\) THEN\s+RAISE EXCEPTION 'An active payment already exists for this order\.'/i);
  assert.match(recordCompleted, /INSERT INTO public\.payment_audit_events[\s\S]*?'PAYMENT_CONFIRMED'/i);
});

test("application surfaces the active-payment conflict in all supported languages", () => {
  assert.match(paymentAction, /existingPending\.method !== method/);
  assert.match(paymentAction, /paymentError\?\.code === "23505"/);
  assert.match(ordersView, /"An active payment already exists for this order\.": "activePaymentExistsError"/);
  assert.match(serverPos, /t\("activePaymentExistsError"\)/);
  assert.match(languageProvider, /activePaymentExistsError: \{ en:[^\n]*am:[^\n]*om:[^\n]*ti:/);
});