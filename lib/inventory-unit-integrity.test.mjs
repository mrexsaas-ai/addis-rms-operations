import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/045_inventory_unit_integrity.sql", import.meta.url),
  "utf8",
);
const inventorySchema = readFileSync(
  new URL("../supabase/migrations/009_inventory_foundation.sql", import.meta.url),
  "utf8",
);
const hardeningMigration = readFileSync(
  new URL("../supabase/migrations/027_security_hardening.sql", import.meta.url),
  "utf8",
);
const recipeMigration = readFileSync(
  new URL("../supabase/migrations/042_safe_inventory_recipe_units.sql", import.meta.url),
  "utf8",
);
const recipeSchema = readFileSync(
  new URL("../supabase/migrations/019_inventory_recipes_and_completion.sql", import.meta.url),
  "utf8",
);
const legacyStockRequestMigration = readFileSync(
  new URL("../supabase/migrations/020_stock_request_workflow.sql", import.meta.url),
  "utf8",
);
const stockRequestMigration = readFileSync(
  new URL("../supabase/migrations/021_free_text_stock_requests.sql", import.meta.url),
  "utf8",
);
const inventoryActions = readFileSync(new URL("../app/inventory/actions.js", import.meta.url), "utf8");
const inventoryForm = readFileSync(new URL("../app/inventory/InventoryItemForm.js", import.meta.url), "utf8");
const languageProvider = readFileSync(new URL("../app/i18n/LanguageProvider.js", import.meta.url), "utf8");

test("inventory base unit and recipe/movement quantities match the existing schema", () => {
  assert.match(inventorySchema, /unit text not null,[\s\S]*?current_quantity numeric\(12, 3\) not null default 0/i);
  assert.match(inventorySchema, /create table if not exists public\.stock_movements[\s\S]*?item_id uuid not null references public\.inventory_items/i);
  assert.match(inventorySchema, /quantity_delta numeric\(12, 3\)[\s\S]*?unit text not null/i);
  assert.match(recipeSchema, /quantity_required numeric\(12, 3\) not null[\s\S]*?unit text not null/i);
});

test("valid supported units remain available for new items and unused items can change units", () => {
  assert.match(inventoryActions, /INVENTORY_UNITS\.includes\(payload\.unit\)/);
  assert.match(inventoryForm, /\["kg", "g", "L", "ml", "pcs", "box"\]/);
  const guard = migration.slice(migration.indexOf("CREATE OR REPLACE FUNCTION public.guard_inventory_item_unit_change"), migration.indexOf("\n$$;", migration.indexOf("CREATE OR REPLACE FUNCTION public.guard_inventory_item_unit_change")) + 4);
  assert.match(guard, /IF TG_OP = 'UPDATE' AND NEW\.unit IS DISTINCT FROM OLD\.unit THEN/);
  assert.match(guard, /OLD\.current_quantity <> 0/);
  assert.match(guard, /OLD\.minimum_stock_level <> 0/);
  assert.match(guard, /OLD\.cost_price <> 0/);
  assert.match(guard, /public\.stock_movements/);
  assert.match(guard, /public\.menu_item_inventory_items/);
  assert.match(guard, /RETURN NEW;/);
});

test("unit changes after stock or recipe use are rejected without deleting history", () => {
  assert.match(migration, /stock_movements sm[\s\S]*?WHERE sm\.unit IS DISTINCT FROM i\.unit/i);
  assert.match(migration, /reconcile without deleting history/i);
  assert.match(migration, /Inventory item unit cannot be changed after stock, movement, recipe use, or unit-based settings\./);
  assert.match(migration, /CREATE TRIGGER inventory_items_unit_integrity[\s\S]*?BEFORE INSERT OR UPDATE ON public\.inventory_items/);
  assert.doesNotMatch(migration, /DELETE\s+FROM\s+public\.(inventory_items|stock_movements|menu_item_inventory_items)/i);
  assert.doesNotMatch(migration, /UPDATE\s+public\.stock_movements/i);
});

test("future stock movement deltas convert to and are recorded in the base unit", () => {
  const applyStart = migration.indexOf("CREATE OR REPLACE FUNCTION public.apply_stock_movement");
  const applyEnd = migration.indexOf("\n$$;", applyStart) + 4;
  const applyStockMovement = migration.slice(applyStart, applyEnd);

  assert.match(applyStockMovement, /public\.convert_recipe_stock_quantity\(\s*abs\(p_quantity_delta\), v_input_unit, v_item\.unit\s*\)/i);
  assert.match(applyStockMovement, /FOR UPDATE/i);
  assert.match(applyStockMovement, /quantity_delta, unit, unit_cost,[\s\S]*?v_quantity_delta, v_item\.unit, v_unit_cost/i);
  assert.match(applyStockMovement, /previous_quantity, new_quantity, performed_by_user_id/);
  assert.match(applyStockMovement, /WHERE id = p_item_id AND restaurant_id = p_restaurant_id\s+FOR UPDATE/i);
  assert.match(applyStockMovement, /public\.has_restaurant_role\(p_restaurant_id, array\['ADMIN', 'OWNER', 'MANAGER'\]\)/i);
});

test("recipe validation serializes against base-unit changes and preserves tenant/role policies", () => {
  assert.match(migration, /WHERE id = NEW\.inventory_item_id AND restaurant_id = NEW\.restaurant_id\s+FOR UPDATE/i);
  assert.match(migration, /public\.convert_recipe_stock_quantity\(NEW\.quantity_required, NEW\.unit, v_inventory_unit\)/i);
  assert.match(hardeningMigration, /GRANT UPDATE \(category_id, supplier_id, name, sku, description, unit, minimum_stock_level, cost_price, station, is_active, updated_at\)/i);
  assert.doesNotMatch(migration, /CREATE POLICY|DROP POLICY|ALTER TABLE public\.inventory_items ENABLE ROW LEVEL SECURITY/i);
});

test("kg/g and L/ml recipe conversions and atomic station deduction remain in place", () => {
  assert.match(recipeMigration, /when 'kg' then 1000[\s\S]*?when 'g' then 1/i);
  assert.match(recipeMigration, /when 'L' then 1000[\s\S]*?when 'ml' then 1/i);
  assert.match(recipeMigration, /FOR UPDATE OF ko, o/i);
  assert.match(recipeMigration, /FOR UPDATE OF i/i);
  assert.match(recipeMigration, /v_requirement\.current_quantity < v_requirement\.required_quantity/i);
  assert.match(recipeMigration, /raise exception 'Inventory changed during station completion; retry the operation\.'/i);
});

test("stock request fulfillment still uses the protected movement RPC", () => {
  assert.match(legacyStockRequestMigration, /public\.apply_stock_movement\([\s\S]*?v_request\.quantity,[\s\S]*?v_request\.unit/i);
  assert.match(stockRequestMigration, /set item_id = v_item\.id, unit = v_item\.unit/i);
  assert.match(stockRequestMigration, /public\.apply_stock_movement\([\s\S]*?v_request\.quantity,[\s\S]*?v_item\.unit/i);
  assert.match(migration, /public\.convert_recipe_stock_quantity\([\s\S]*?v_input_unit, v_item\.unit/i);
});

test("database unit-lock rejection is mapped to four-language UI text", () => {
  assert.match(inventoryActions, /error\?\.code === "23514"[\s\S]*?inventoryUnitInUse/);
  assert.match(inventoryForm, /t\(state\.error\)/);
  assert.match(languageProvider, /inventoryUnitInUse: \{ en:[^\n]*am:[^\n]*om:[^\n]*ti:/);
});