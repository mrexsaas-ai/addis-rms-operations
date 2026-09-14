import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext, SERVICE_ROLES } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }) {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await getAuthContext(supabase);
  const { id } = await params;

  if (!user) redirect("/login");
  if (!membership || !SERVICE_ROLES.includes(membership.role)) redirect("/");

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, subtotal, total, status, created_at, notes, tables(table_number, name), order_items(quantity, unit_price, subtotal, menu_items(name))"
    )
    .eq("id", id)
    .eq("restaurant_id", membership.restaurant_id)
    .maybeSingle();

  if (error) throw error;
  if (!order) notFound();

  const [{ data: payments, error: paymentsError }, { data: restaurant, error: restaurantError }] = await Promise.all([
    supabase
    .from("payments")
    .select("amount, method, status, created_at, reference_number, cash_received, change_amount")
    .eq("order_id", order.id)
    .eq("restaurant_id", membership.restaurant_id)
    .order("created_at", { ascending: true }),
    supabase
      .from("restaurants")
      .select("name")
      .eq("id", membership.restaurant_id)
      .maybeSingle(),
  ]);

  if (paymentsError) throw paymentsError;
  if (restaurantError) throw restaurantError;
  const paidAmount = (payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const cashPayment = (payments || []).find((payment) => payment.method === "CASH");

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 32 }}>
      <h1>{restaurant?.name || "Restaurant"} — Receipt</h1>
      <p>Order {order.order_number}</p>
      <p>{new Date(order.created_at).toLocaleString("en-US")}</p>
      <p>{order.tables?.name || (order.tables?.table_number ? `Table ${order.tables.table_number}` : "Takeaway")}</p>
      <ul>
        {(order.order_items || []).map((item, index) => (
          <li key={`${item.menu_items?.name || "item"}-${index}`}>
            {item.quantity} x {item.menu_items?.name || "Item"} — ETB {item.subtotal}
          </li>
        ))}
      </ul>
      <p>Subtotal: ETB {order.subtotal}</p>
      <strong>Total: ETB {order.total}</strong>
      {payments?.length ? (
        <div>
          <p>Payment method: {payments.map((payment) => payment.method).join(", ")}</p>
          <p>Amount paid: ETB {paidAmount.toFixed(2)}</p>
          {payments.find((payment) => payment.reference_number) ? (
            <p>Reference: {payments.find((payment) => payment.reference_number).reference_number}</p>
          ) : null}
          {cashPayment?.change_amount != null ? (
            <p>Change: ETB {Number(cashPayment.change_amount).toFixed(2)}</p>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
