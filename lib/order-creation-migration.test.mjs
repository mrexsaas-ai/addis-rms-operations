import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/051_order_total_recalculation_integrity.sql", import.meta.url),
  "utf8",
);
const lifecycleMigration = readFileSync(new URL("../supabase/migrations/026_platform_restaurant_lifecycle.sql", import.meta.url), "utf8");
const serverAction = readFileSync(new URL("../app/server/actions.js", import.meta.url), "utf8");
const ordersAction = readFileSync(new URL("../app/orders/actions.js", import.meta.url), "utf8");
const serverPosClient = readFileSync(new URL("../app/server/ServerPOSClient.js", import.meta.url), "utf8");
const languageProvider = readFileSync(new URL("../app/i18n/LanguageProvider.js", import.meta.url), "utf8");

const rpcStart = migration.indexOf("create or replace function public.create_order_atomic");
const rpcEnd = migration.indexOf("\n$$;", rpcStart) + 4;
const rpc = migration.slice(rpcStart, rpcEnd);

test("atomic RPC accepts the existing order types and validates dine-in table ownership", () => {
  assert.match(rpc, /'DINE_IN', 'TAKEAWAY', 'DELIVERY'/);
  assert.match(serverAction, /p_order_type: orderType/);
  assert.match(ordersAction, /const orderType = tableId \? "DINE_IN" : "TAKEAWAY"/);
  assert.match(rpc, /v_order_number_prefix not in \('POS', 'ORD'\)/i);
  assert.match(rpc, /v_order_type = 'DINE_IN' and p_table_id is null/i);
  assert.match(rpc, /where id = p_table_id\s+and restaurant_id = v_restaurant_id\s+for update/i);
  assert.match(rpc, /status not in \('AVAILABLE', 'RESERVED'\)/i);
});

test("authenticated membership, active tenant role, and isolated table/menu lookups are enforced", () => {
  assert.ok(/v_user_id uuid := auth\.uid\(\)/i.test(rpc) && /if v_user_id is null then/i.test(rpc), "RPC must require an authenticated user");
  assert.ok(/count\(\*\)[\s\S]*?where user_id = v_user_id/i.test(rpc), "RPC must require exactly one membership");
  assert.ok(/public\.has_restaurant_role\(v_restaurant_id, array\['ADMIN', 'OWNER', 'MANAGER', 'SERVER'\]\)/i.test(rpc), "RPC must enforce an active service role");
  assert.match(lifecycleMigration, /and r\.status = 'ACTIVE'/i);
  assert.ok(/where restaurant_id = v_restaurant_id\s+and id = any\(v_item_ids\)\s+and is_available = true/i.test(rpc), "menu reads must stay tenant-scoped");
  assert.ok(/m\.restaurant_id = v_restaurant_id/i.test(rpc), "item insertion must use tenant-scoped menu data");
  assert.doesNotMatch(rpc, /p_restaurant_id/);
});

test("RPC ignores client prices and calculates order items from locked database prices", () => {
  assert.match(rpc, /select id, name, price, station[\s\S]*?for share/i);
  assert.match(rpc, /v_subtotal := v_subtotal \+ \(v_menu_item\.price \* v_quantities\[v_item_index\]\)/i);
  assert.match(rpc, /cart\.quantity,\s*m\.price,\s*m\.price \* cart\.quantity/i);
  assert.doesNotMatch(rpc, /p_price|p_total|p_restaurant_id/);
});

test("all cart items and kitchen/bar station routes are created by the same RPC", () => {
  assert.match(serverAction, /p_items: \[\.\.\.normalizedCart\]\.map/);
  assert.match(ordersAction, /p_items: \[\{ id: menuItemId, quantity \}\]/);
  assert.match(rpc, /jsonb_array_elements\(p_items\)/i);
  assert.match(rpc, /insert into public\.orders/i);
  assert.match(rpc, /insert into public\.order_items/i);
  assert.match(rpc, /insert into public\.kitchen_orders/i);
  assert.match(rpc, /select distinct v_restaurant_id, v_order_id, m\.station, 'NEW'/i);
  assert.match(rpc, /m\.station not in \('KITCHEN', 'BAR'\)/i);
});

test("dine-in table occupation always occurs inside the RPC", () => {
  assert.match(rpc, /if v_order_type = 'DINE_IN' then/i);
  assert.match(rpc, /set status = 'OCCUPIED'/i);
  assert.match(rpc, /if not found then\s+raise exception 'The selected table could not be marked occupied\.'/i);
});

test("both new dine-in flows accept only available or reserved tables after locking", () => {
  const tableLock = rpc.indexOf("for update;");
  const stateGuard = rpc.indexOf("if v_table.status not in ('AVAILABLE', 'RESERVED') then");
  const firstOrderInsert = rpc.indexOf("insert into public.orders");
  const occupyTable = rpc.indexOf("update public.tables");

  assert.ok(tableLock >= 0);
  assert.ok(stateGuard > tableLock);
  assert.match(rpc.slice(tableLock, stateGuard), /if v_creation_flow = 'SERVER_POS' then[\s\S]*?if found then[\s\S]*?return jsonb_build_object\([\s\S]*?existing_order', true/i);
  assert.ok(firstOrderInsert > stateGuard);
  assert.ok(occupyTable > stateGuard);
  assert.match(rpc, /status in \('AVAILABLE', 'RESERVED'\)/i);
  assert.match(rpc, /and \(v_creation_flow <> 'SERVER_POS' or status in \('AVAILABLE', 'RESERVED'\)\)/i);
  assert.match(rpc, /if v_order_type = 'DINE_IN' then[\s\S]*?select id, status[\s\S]*?for update/i);
  assert.match(rpc, /Only available or reserved tables can be used for a new dine-in order/i);
});

test("ORDERS_PAGE and SERVER_POS eligibility accepts AVAILABLE/RESERVED and rejects OCCUPIED/CLEANING", () => {
  const guard = rpc.match(/if v_table\.status not in \('([A-Z]+)', '([A-Z]+)'\) then/i);
  assert.ok(guard, "RPC must contain an explicit locked-table state allowlist");
  const allowedStates = new Set([guard[1], guard[2]]);

  for (const flow of ["ORDERS_PAGE", "SERVER_POS"]) {
    assert.equal(allowedStates.has("AVAILABLE"), true, `${flow} accepts AVAILABLE`);
    assert.equal(allowedStates.has("RESERVED"), true, `${flow} accepts RESERVED`);
    assert.equal(allowedStates.has("OCCUPIED"), false, `${flow} rejects OCCUPIED`);
    assert.equal(allowedStates.has("CLEANING"), false, `${flow} rejects CLEANING`);
  }
});

test("order-page table eligibility leaves takeaway and delivery paths unchanged", () => {
  assert.match(rpc, /if v_order_type = 'DINE_IN' then[\s\S]*?if v_table\.status not in \('AVAILABLE', 'RESERVED'\) then[\s\S]*?end if;/i);
  assert.match(rpc, /if v_order_type <> 'DINE_IN' and p_table_id is not null then/i);
  assert.match(rpc, /case when v_order_type = 'DINE_IN' then p_table_id else null end/i);
  assert.match(rpc, /if v_order_type = 'DINE_IN' then[\s\S]*?update public\.tables/i);
});

test("invalid menu items and tables fail before order writes", () => {
  assert.match(rpc, /and is_available = true/i);
  assert.match(rpc, /if v_menu_item_count <> cardinality\(v_item_ids\) then/i);
  assert.match(rpc, /That table does not belong to this restaurant/i);
  assert.match(rpc, /Only available or reserved tables can be used/i);
  const firstOrderWrite = rpc.indexOf("insert into public.orders");
  assert.ok(firstOrderWrite > rpc.indexOf("if v_menu_item_count <> cardinality"));
});

test("manual payment flows are unchanged by the order migration", () => {
  assert.doesNotMatch(migration, /create or replace function public\.(record_completed_payment|create_pending_payment|resolve_pending_payment)/i);
  assert.match(ordersAction, /record_completed_payment/);
  assert.match(ordersAction, /create_pending_payment/);
  assert.match(ordersAction, /resolve_pending_payment/);
});

test("Server POS keeps active-order reuse and both application actions use only the RPC", () => {
  assert.match(rpc, /if v_creation_flow = 'SERVER_POS' then/i);
  assert.match(rpc, /not exists \([\s\S]*?p\.status = 'COMPLETED'/i);
  assert.match(serverAction, /p_creation_flow: "SERVER_POS"/);
  assert.match(ordersAction, /p_creation_flow: "ORDERS_PAGE"/);
  assert.match(serverAction, /supabase\.rpc\("create_order_atomic"/);
  assert.match(ordersAction, /supabase\.rpc\("create_order_atomic"/);
  assert.match(serverAction, /p_order_number_prefix: "POS"/);
  assert.match(ordersAction, /p_order_number_prefix: "ORD"/);
  assert.doesNotMatch(serverAction, /from\("orders"\)\.delete/);
  assert.doesNotMatch(ordersAction, /from\("orders"\)\.delete/);
  assert.doesNotMatch(serverAction, /from\("orders"\)\.insert/);
  assert.doesNotMatch(ordersAction, /from\("orders"\)\.insert/);
});

test("Server POS does not treat a reused ETB 500 order as a submitted ETB 780 cart", () => {
  const submitStart = serverPosClient.indexOf("async function submitOrder");
  const submitEnd = serverPosClient.indexOf("\nfunction formatCurrency", submitStart);
  const submitOrder = serverPosClient.slice(submitStart, submitEnd);
  const reuseBranchMatch = submitOrder.match(/if \(result\?\.existingOrder\) \{([\s\S]*?)\n    \}/);
  const cartTotal = 780;
  const existingOrderTotal = 500;

  assert.ok(reuseBranchMatch, "the existing-order response must have a dedicated branch");
  assert.notEqual(cartTotal, existingOrderTotal);
  const reuseBranch = reuseBranchMatch[1];
  assert.match(reuseBranch, /\.\.\.defaultState/);
  assert.match(reuseBranch, /existingOrder: result\.existingOrder/);
  assert.doesNotMatch(reuseBranch, /success:\s*true|orderTotal\s*:|orderId\s*:/);
  assert.match(serverPosClient, /state\.existingOrder &&/);
  assert.match(serverPosClient, /state\.success && state\.orderId && paymentOpen/);
  assert.match(serverPosClient, /href="\/orders" target="_blank"/);
  assert.match(languageProvider, /serverExistingOrderNotSubmitted:[\s\S]*?Your new cart was not submitted/i);
});

test("RPC is SECURITY DEFINER with fixed search path and authenticated-only execution", () => {
  assert.match(rpc, /security definer/i);
  assert.match(rpc, /set search_path = public, pg_temp/i);
  assert.match(migration, /revoke all on function public\.create_order_atomic\(text, text, text, uuid, text, text, jsonb\) from public, anon/i);
  assert.match(migration, /grant execute on function public\.create_order_atomic\(text, text, text, uuid, text, text, jsonb\) to authenticated/i);
  assert.doesNotMatch(migration, /create policy[^;]*on public\.orders[^;]*for delete/i);
  assert.doesNotMatch(migration, /grant[^;]*delete[^;]*public\.orders/i);
});

test("the RPC contains no exception-swallowing handler that could commit partial writes", () => {
  assert.match(rpc, /when invalid_text_representation or numeric_value_out_of_range[\s\S]*?raise exception 'Cart item ID and quantity must be valid\.'/i);
  assert.doesNotMatch(rpc, /when others/i);
  assert.match(rpc, /insert into public\.order_items[\s\S]*?if not found then\s+raise exception 'Order items could not be created\.'/i);
  assert.match(rpc, /update public\.tables[\s\S]*?if not found then\s+raise exception 'The selected table could not be marked occupied\.'/i);
  assert.match(rpc, /raise exception 'Order items could not be created\.'/i);
  assert.match(rpc, /raise exception 'The selected table could not be marked occupied\.'/i);
});

test("RPC explicitly recalculates persisted order line totals before returning the parent total", () => {
  const itemInsert = rpc.indexOf("insert into public.order_items");
  const explicitTotalUpdate = rpc.indexOf("update public.orders o");
  const returnTotalRead = rpc.indexOf("select total into v_order_total");
  const updateBlock = rpc.slice(explicitTotalUpdate, returnTotalRead);

  assert.ok(itemInsert >= 0, "RPC must insert order items");
  assert.ok(explicitTotalUpdate > itemInsert, "parent total update must follow order-item insertion");
  assert.ok(returnTotalRead > explicitTotalUpdate, "parent total update must precede returned total read");
  assert.match(updateBlock, /coalesce\(sum\(oi\.subtotal\), 0\)/i);
  assert.match(updateBlock, /where oi\.order_id = v_order_id\s+and oi\.restaurant_id = v_restaurant_id/i);
  assert.match(updateBlock, /set subtotal = totals\.order_total,\s+total = totals\.order_total/i);
  assert.match(updateBlock, /get diagnostics v_updated_order_count = row_count/i);
  assert.match(updateBlock, /if v_updated_order_count <> 1 then\s+raise exception/i);
});
