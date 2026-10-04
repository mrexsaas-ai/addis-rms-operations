import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { convertRecipeQuantity } from "./inventory-units.mjs";

const inventoryMigration = readFileSync(
  new URL("../supabase/migrations/042_safe_inventory_recipe_units.sql", import.meta.url),
  "utf8",
);

test("identical inventory and recipe units need no conversion", () => {
  assert.deepEqual(convertRecipeQuantity(1.25, "kg", "kg"), { ok: true, quantity: 1.25 });
  assert.deepEqual(convertRecipeQuantity(4, "pcs", "pcs"), { ok: true, quantity: 4 });
  assert.deepEqual(convertRecipeQuantity(2, "box", "box"), { ok: true, quantity: 2 });
});

test("mass and volume units convert exactly in both directions", () => {
  assert.deepEqual(convertRecipeQuantity(1000, "g", "kg"), { ok: true, quantity: 1 });
  assert.deepEqual(convertRecipeQuantity(1.25, "kg", "g"), { ok: true, quantity: 1250 });
  assert.deepEqual(convertRecipeQuantity(1000, "ml", "L"), { ok: true, quantity: 1 });
  assert.deepEqual(convertRecipeQuantity(1.5, "L", "ml"), { ok: true, quantity: 1500 });
});

test("incompatible dimensions and count-unit substitutions are rejected", () => {
  assert.equal(convertRecipeQuantity(1, "kg", "L").reason, "incompatible_units");
  assert.equal(convertRecipeQuantity(1, "g", "pcs").reason, "incompatible_units");
  assert.equal(convertRecipeQuantity(1, "L", "pcs").reason, "incompatible_units");
  assert.equal(convertRecipeQuantity(1, "box", "pcs").reason, "incompatible_units");
});

test("invalid units, non-positive quantities, and unrepresentable stock precision fail", () => {
  assert.equal(convertRecipeQuantity(0, "kg", "kg").reason, "invalid_quantity");
  assert.equal(convertRecipeQuantity(-1, "kg", "kg").reason, "invalid_quantity");
  assert.equal(convertRecipeQuantity(Number.NaN, "kg", "kg").reason, "invalid_quantity");
  assert.equal(convertRecipeQuantity(1, "gallon", "L").reason, "invalid_unit");
  assert.equal(convertRecipeQuantity(0.1, "g", "kg").reason, "stock_precision");
});

test("station completion preflights every ingredient before the first stock write", () => {
  const functionStart = inventoryMigration.indexOf("create or replace function public.complete_station_order");
  assert.notEqual(functionStart, -1);
  const completionRpc = inventoryMigration.slice(functionStart);
  const preflightStart = completionRpc.indexOf("for v_requirement in");
  const preflightEnd = completionRpc.indexOf("end loop;", preflightStart);
  const firstStockUpdate = completionRpc.indexOf("update public.inventory_items");

  assert.ok(preflightStart >= 0);
  assert.ok(preflightEnd > preflightStart);
  assert.ok(firstStockUpdate > preflightEnd);
  const preflight = completionRpc.slice(preflightStart, preflightEnd);
  assert.match(preflight, /sum\(public\.convert_recipe_stock_quantity/i);
  assert.match(preflight, /current_quantity < v_requirement\.required_quantity/i);
  assert.match(preflight, /raise exception 'Insufficient inventory/i);
  assert.match(completionRpc, /public\.has_restaurant_role\([\s\S]*?v_order\.restaurant_id/i);
  assert.match(completionRpc, /i\.restaurant_id = r\.restaurant_id/i);
  assert.match(completionRpc, /oi\.restaurant_id = v_order\.restaurant_id/i);
});