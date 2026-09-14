import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { updateBarOrder } from "./actions";
import WorkspaceLiveAlerts from "../WorkspaceLiveAlerts";

export const dynamic = "force-dynamic";

export default async function BarPage() {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await getAuthContext(supabase);
  if (!user) redirect("/login");
  if (!membership || !["ADMIN", "OWNER", "MANAGER", "BARMAN"].includes(membership.role)) redirect("/");
  const { data: orders, error } = await supabase.from("kitchen_orders").select("id, status, created_at, orders(order_number, tables(table_number, name), order_items(quantity, notes, menu_items(name)) )").eq("restaurant_id", membership.restaurant_id).eq("station", "BAR").order("created_at", { ascending: true });
  if (error) throw error;
  return <main className="workspace-page"><header className="workspace-header"><div><p className="eyebrow">BAR WORKSPACE</p><h1>Bar orders</h1><p>NEW, PREPARING, READY, and COMPLETED.</p></div></header><WorkspaceLiveAlerts restaurantId={membership.restaurant_id} station="BAR" /><section className="kds-grid">{(orders || []).map((order) => <article className="kds-card" key={order.id}><strong>{order.orders?.order_number}</strong><span>{order.orders?.tables?.name || `Table ${order.orders?.tables?.table_number || "Takeaway"}`}</span><p>{(order.orders?.order_items || []).map((item) => `${item.quantity} x ${item.menu_items?.name || "Item"}`).join(", ")}</p><b>{order.status}</b><form action={updateBarOrder}><input type="hidden" name="id" value={order.id} /><div className="kds-actions">{["NEW", "PREPARING", "READY", "COMPLETED"].map((status) => <button type="submit" name="status" value={status} key={status}>{status}</button>)}</div></form></article>)}{!orders?.length && <p>No bar orders.</p>}</section></main>;
}