import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/046_kitchen_order_completion_integrity.sql", import.meta.url),
  "utf8",
);
const kitchenAction = readFileSync(new URL("../app/kitchen/actions.js", import.meta.url), "utf8");
const barAction = readFileSync(new URL("../app/bar/actions.js", import.meta.url), "utf8");

const startFunctionStart = migration.indexOf("create or replace function public.start_station_order");
const startFunctionEnd = migration.indexOf("\n$$;", startFunctionStart) + 4;
const startFunction = migration.slice(startFunctionStart, startFunctionEnd);

test("authenticated clients cannot directly update station orders", () => {
  assert.match(migration, /revoke update on table public\.kitchen_orders from public, anon, authenticated/i);
});

test("the start RPC preserves tenant, station-role, and NEW-to-PREPARING restrictions", () => {
  assert.match(startFunction, /security definer/i);
  assert.match(startFunction, /set search_path = public, pg_temp/i);
  assert.match(startFunction, /auth\.uid\(\)/i);
  assert.match(startFunction, /from public\.kitchen_orders ko[\s\S]*?where ko\.id = p_kitchen_order_id[\s\S]*?for update/i);
  assert.match(startFunction, /public\.has_restaurant_role\([\s\S]*?v_order\.restaurant_id[\s\S]*?case when v_order\.station = 'KITCHEN' then 'CHEF' else 'BARMAN' end/i);
  assert.match(startFunction, /if v_order\.status <> 'NEW' then/i);
  assert.match(startFunction, /set status = 'PREPARING', updated_at = now\(\)/i);
  assert.match(migration, /revoke all on function public\.start_station_order\(uuid\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.start_station_order\(uuid\) to authenticated/i);
});

test("kitchen and bar start through the restricted RPC and complete through the stock-aware RPC", () => {
  for (const action of [kitchenAction, barAction]) {
    assert.match(action, /supabase\.rpc\("start_station_order"/);
    assert.match(action, /supabase\.rpc\("complete_station_order"/);
    assert.doesNotMatch(action, /\.from\("kitchen_orders"\)[\s\S]*?\.update\(/);
  }
});