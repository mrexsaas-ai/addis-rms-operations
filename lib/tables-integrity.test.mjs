import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/047_tables_integrity.sql", import.meta.url),
  "utf8",
);
const orderMigration = readFileSync(
  new URL("../supabase/migrations/043_atomic_order_creation.sql", import.meta.url),
  "utf8",
);
const initialSchema = readFileSync(
  new URL("../supabase/migrations/001_initial_schema.sql", import.meta.url),
  "utf8",
);

const guardStart = migration.indexOf("create or replace function public.enforce_table_update_integrity");
const guardEnd = migration.indexOf("\n$$;", guardStart) + 4;
const guard = migration.slice(guardStart, guardEnd);
const serverTransitions = new Set(
  [...guard.matchAll(/\(old\.status = '([A-Z]+)' and new\.status = '([A-Z]+)'\)/g)]
    .map(([, from, to]) => `${from}->${to}`),
);

test("SERVER is limited to the existing three status transitions and same-status updates", () => {
  assert.deepEqual([...serverTransitions].sort(), [
    "AVAILABLE->CLEANING",
    "CLEANING->AVAILABLE",
    "OCCUPIED->AVAILABLE",
  ]);
  assert.match(guard, /if new\.status is distinct from old\.status\s+and not/i);

  const canTransition = (from, to) => from === to || serverTransitions.has(`${from}->${to}`);
  assert.equal(canTransition("AVAILABLE", "CLEANING"), true);
  assert.equal(canTransition("OCCUPIED", "AVAILABLE"), true);
  assert.equal(canTransition("CLEANING", "AVAILABLE"), true);
  assert.equal(canTransition("AVAILABLE", "OCCUPIED"), false);
  assert.equal(canTransition("OCCUPIED", "CLEANING"), false);
  assert.equal(canTransition("AVAILABLE", "RESERVED"), false);
  assert.equal(canTransition("RESERVED", "CLEANING"), false);
  assert.equal(canTransition("AVAILABLE", "AVAILABLE"), true);
});

test("SERVER cannot change manager-only details or move a table to another tenant", () => {
  assert.match(guard, /new\.restaurant_id is distinct from old\.restaurant_id/i);
  assert.match(guard, /new\.table_number is distinct from old\.table_number/i);
  assert.match(guard, /new\.name is distinct from old\.name/i);
  assert.match(guard, /new\.capacity is distinct from old\.capacity/i);
  assert.match(guard, /public\.has_restaurant_role\(old\.restaurant_id,\s*array\['SERVER'\]\)/i);
});

test("ADMIN, OWNER, and MANAGER retain the existing valid status and detail updates", () => {
  assert.match(guard, /public\.has_restaurant_role\([\s\S]*?array\['ADMIN', 'OWNER', 'MANAGER'\]/i);
  assert.match(guard, /if v_is_manager then\s+return new;/i);
  assert.match(initialSchema, /status text not null default 'AVAILABLE' check \(status in \('AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'\)\)/i);
});

test("the trigger uses caller identity and leaves atomic order occupancy behavior intact", () => {
  assert.match(guard, /security invoker/i);
  assert.match(guard, /set search_path = public, pg_temp/i);
  assert.match(guard, /v_actor_user_id uuid := auth\.uid\(\)/i);
  assert.match(guard, /current_user not in \('authenticated', 'anon'\)/i);
  assert.match(migration, /before update on public\.tables/i);
  assert.doesNotMatch(migration, /create or replace function public\.create_order_atomic/i);
  assert.match(orderMigration, /security definer/i);
  assert.match(orderMigration, /set status = 'OCCUPIED'/i);
});