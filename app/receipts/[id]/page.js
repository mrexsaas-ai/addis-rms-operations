import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext, SERVICE_ROLES } from "@/lib/auth";
import PendingPaymentActions from "./PendingPaymentActions";
import { BUSINESS_TIME_ZONE } from "@/lib/business-date.mjs";

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
    .select("id, amount, method, status, created_at, reference_number, cash_received, change_amount")
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
  const verifiedPayments = (payments || []).filter((payment) => payment.status === "COMPLETED");
  const paidAmount = verifiedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const cashPayment = verifiedPayments.find((payment) => payment.method === "CASH");
  const pendingPayments = (payments || []).filter((payment) => payment.status === "PENDING");
  const paymentStatusLabel = (status) => status === "COMPLETED" ? "PAID" : status;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 32 }}>
      <h1>{restaurant?.name || "Restaurant"} — Receipt</h1>
      <p>Order {order.order_number}</p>
      <p>{new Date(order.created_at).toLocaleString("en-US", { timeZone: BUSINESS_TIME_ZONE })}</p>
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
          <p>Payment method: {payments.map((payment) => `${payment.method} (${paymentStatusLabel(payment.status)})`).join(", ")}</p>
          <p>Amount paid: ETB {paidAmount.toFixed(2)}</p>
          {verifiedPayments.find((payment) => payment.reference_number) ? (
            <p>Reference: {verifiedPayments.find((payment) => payment.reference_number).reference_number}</p>
          ) : null}
          {cashPayment?.change_amount != null ? (
            <p>Change: ETB {Number(cashPayment.change_amount).toFixed(2)}</p>
          ) : null}
        </div>
      ) : null}

      {pendingPayments.length ? (
        <section style={{ marginTop: 24, borderTop: "1px solid #e5e7eb", paddingTop: 20 }}>
          <h2>Pending payment verification</h2>
          {pendingPayments.map((payment) => (
            <div key={payment.created_at + payment.method} style={{ marginTop: 12, padding: 12, border: "1px solid rgba(0,229,255,.24)", borderRadius: 8, background: "#101519", color: "#f5fbfc" }}>
              <p><strong>{payment.method}</strong> — {payment.amount ? `ETB ${Number(payment.amount).toFixed(2)}` : "Amount pending"}</p>
              {payment.reference_number ? <p>Reference: {payment.reference_number}</p> : null}
              <PendingPaymentActions payment={payment} />
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
}
