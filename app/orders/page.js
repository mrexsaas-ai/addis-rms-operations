import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SERVICE_ROLES, getAuthContext } from "@/lib/auth";
import { createOrder, recordPayment } from "./actions";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await getAuthContext(supabase);
  if (!user) redirect("/login");
  if (!membership || !SERVICE_ROLES.includes(membership.role)) redirect("/");

  const results = await Promise.all([
    supabase.from("menu_items").select("id, name, price, station").eq("restaurant_id", membership.restaurant_id).eq("is_available", true).order("name"),
    supabase.from("tables").select("id, table_number, name").eq("restaurant_id", membership.restaurant_id).order("table_number"),
    supabase.from("orders").select("id, order_number, total, status, created_at, tables(table_number, name)").eq("restaurant_id", membership.restaurant_id).order("created_at", { ascending: false }).limit(30),
  ]);
  const queryError = results.find((result) => result.error)?.error;
  if (queryError) throw queryError;
  const [{ data: menuItems }, { data: tables }, { data: orders }] = results;

  return (
    <main className="workspace-page">
      <header className="workspace-header"><div><p className="eyebrow">SERVER WORKSPACE</p><h1>Orders</h1><p>Create an order and send it to the right station.</p></div><Link href="/">Overview</Link></header>
      <section className="workspace-grid">
        <form className="workspace-panel" action={createOrder}>
          <p className="eyebrow">NEW ORDER</p><h2>Send to kitchen or bar</h2>
          <label>Menu item<select name="menu_item_id" required><option value="">Select an item</option>{(menuItems || []).map((item) => <option value={item.id} key={item.id}>{item.name} - {item.station} - ETB {item.price}</option>)}</select></label>
          <label>Quantity<input name="quantity" type="number" min="1" defaultValue="1" required /></label>
          <label>Table<select name="table_id"><option value="">Takeaway</option>{(tables || []).map((table) => <option value={table.id} key={table.id}>Table {table.table_number}{table.name ? ` - ${table.name}` : ""}</option>)}</select></label>
          <label>Notes<textarea name="notes" rows="3" /></label>
          <button type="submit">Create order</button>
        </form>
        <section className="workspace-panel"><p className="eyebrow">CURRENT ORDERS</p><h2>Today</h2><div className="workspace-list">{(orders || []).map((order) => <article className="workspace-row" key={order.id}><strong>{order.order_number}</strong><span>{order.status}</span><span>ETB {order.total}</span><form action={recordPayment}><input type="hidden" name="order_id" value={order.id} /><input name="amount" type="number" min="0.01" step="0.01" placeholder="Amount" required /><select name="method" defaultValue="CASH"><option value="CASH">Cash</option><option value="TELEBIRR">Telebirr</option><option value="BANK_TRANSFER">Bank transfer</option></select><input name="reference_number" placeholder="Reference (optional)" /><button type="submit">Record payment</button></form></article>)}{!orders?.length && <p>No orders yet.</p>}</div></section>
      </section>
    </main>
  );
}