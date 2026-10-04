import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SERVICE_ROLES, getAuthContext } from "@/lib/auth";
import { toBusinessInstant } from "../staff/attendanceSelection";
import OrdersView from "./OrdersView";
import ServerOrderCompletionAlerts from "../ServerOrderCompletionAlerts";

export const dynamic = "force-dynamic";

const HISTORY_RANGES = ["LAST_7_DAYS", "THIS_WEEK", "ALL"];

function businessDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date).replace(/\//g, "-");
}

function shiftBusinessDate(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

function historyBounds(range) {
  if (range === "ALL") return { start: null, end: null };

  const today = businessDateKey();
  const startDate = range === "THIS_WEEK"
    ? shiftBusinessDate(today, -(new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7)
    : shiftBusinessDate(today, -6);
  const endDate = shiftBusinessDate(today, 1);

  return {
    start: new Date(toBusinessInstant(startDate, "00:00:00")).toISOString(),
    end: new Date(toBusinessInstant(endDate, "00:00:00") - 1).toISOString(),
  };
}

export default async function OrdersPage({ searchParams = {} }) {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await getAuthContext(supabase);
  if (!user) redirect("/login");
  if (!membership || !SERVICE_ROLES.includes(membership.role)) redirect("/");

  const resolvedSearchParams = await searchParams;
  const requestedRange = typeof resolvedSearchParams.historyRange === "string" ? resolvedSearchParams.historyRange : "LAST_7_DAYS";
  const historyRange = HISTORY_RANGES.includes(requestedRange) ? requestedRange : "LAST_7_DAYS";
  const bounds = historyBounds(historyRange);
  let historyQuery = supabase
    .from("orders")
    .select("id, order_number, total, status, created_at, table_id, tables(table_number, name)")
    .eq("restaurant_id", membership.restaurant_id);
  if (bounds.start) historyQuery = historyQuery.gte("created_at", bounds.start);
  if (bounds.end) historyQuery = historyQuery.lte("created_at", bounds.end);
  historyQuery = historyQuery.order("created_at", { ascending: false });

  const results = await Promise.all([
    supabase.from("menu_items").select("id, name, price, station").eq("restaurant_id", membership.restaurant_id).eq("is_available", true).order("name"),
    supabase.from("tables").select("id, table_number, name").eq("restaurant_id", membership.restaurant_id).order("table_number"),
    supabase.from("orders").select("id, order_number, total, status, notes, created_at, created_by, tables(table_number, name), kitchen_orders(status)").eq("restaurant_id", membership.restaurant_id).order("created_at", { ascending: false }).limit(30),
    supabase.from("restaurant_settings").select("enabled_payment_methods").eq("restaurant_id", membership.restaurant_id).maybeSingle(),
    historyQuery,
  ]);
  const queryError = results.find((result) => result.error)?.error;
  if (queryError) throw queryError;
  const [{ data: menuItems }, { data: tables }, { data: orders }, { data: settings }, { data: historyOrders }] = results;

const orderIds = (orders || []).map((order) => order.id);

const creatorIds = [
  ...new Set(
    (orders || [])
      .map((order) => order.created_by)
      .filter(Boolean)
  ),
];

const [orderItemsResult, profilesResult] = await Promise.all([
  orderIds.length
    ? supabase
        .from("order_items")
        .select("id, order_id, quantity, menu_items(name)")
        .eq("restaurant_id", membership.restaurant_id)
        .in("order_id", orderIds)
    : Promise.resolve({ data: [], error: null }),

  creatorIds.length
    ? supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", creatorIds)
    : Promise.resolve({ data: [], error: null }),
]);

if (orderItemsResult.error) throw orderItemsResult.error;
if (profilesResult.error) throw profilesResult.error;

const paymentsResult = orderIds.length
  ? await supabase
      .from("payments")
      .select("order_id, status, amount, created_at")
      .eq("restaurant_id", membership.restaurant_id)
      .in("order_id", orderIds)
      .order("created_at", { ascending: false })
  : { data: [], error: null };

if (paymentsResult.error) throw paymentsResult.error;

const historyOrderIds = (historyOrders || []).map((order) => order.id);
const historyPaymentsResult = historyOrderIds.length
  ? await supabase
      .from("payments")
      .select("order_id, status, method, created_at")
      .eq("restaurant_id", membership.restaurant_id)
      .in("order_id", historyOrderIds)
      .order("created_at", { ascending: false })
  : { data: [], error: null };

if (historyPaymentsResult.error) throw historyPaymentsResult.error;

const orderItems = orderItemsResult.data || [];
const profiles = profilesResult.data || [];
const payments = paymentsResult.data || [];
const historyPaymentByOrder = new Map();
for (const payment of historyPaymentsResult.data || []) {
  const current = historyPaymentByOrder.get(payment.order_id);
  if (!current || payment.status === "COMPLETED" || (current.status !== "COMPLETED" && payment.status === "PENDING")) {
    historyPaymentByOrder.set(payment.order_id, payment);
  }
}

const profileMap = new Map(
  profiles.map((profile) => [
    profile.id,
    profile.full_name || "Not assigned",
  ])
);

const itemsByOrder = new Map();
const paymentsByOrder = new Map();

for (const payment of payments) {
  if (!paymentsByOrder.has(payment.order_id)) paymentsByOrder.set(payment.order_id, payment);
}

for (const item of orderItems) {
  const current = itemsByOrder.get(item.order_id) || [];

  current.push({
    name: item.menu_items?.name || "",
    quantity: Number(item.quantity || 0),
  });

  itemsByOrder.set(item.order_id, current);
}

const recentOrders = (orders || []).map((order) => ({
  ...order,
  status: order.status === "NEW" && (order.kitchen_orders || []).some((stationOrder) => stationOrder.status === "PREPARING")
    ? "PREPARING"
    : order.status,
  serverName: profileMap.get(order.created_by) || "Not assigned",
  items: itemsByOrder.get(order.id) || [],
  payment: paymentsByOrder.get(order.id) || null,
  orderType: order.notes?.split(" |")[0] || "DINE_IN",
}));
  const historicalOrders = (historyOrders || []).map((order) => ({
    ...order,
    payment: historyPaymentByOrder.get(order.id) || null,
    paymentState: historyPaymentByOrder.get(order.id)?.status === "COMPLETED"
      ? "PAID"
      : historyPaymentByOrder.get(order.id)?.status === "PENDING"
        ? "PENDING"
        : "UNPAID",
    paymentMethod: historyPaymentByOrder.get(order.id)?.method || null,
  }));
  const enabledPaymentMethods = settings?.enabled_payment_methods || ["CASH"];
  const paymentOptions = ["CASH", "TELEBIRR", "BANK_TRANSFER"].filter((method) => enabledPaymentMethods.includes(method));
  const canMonitorOrders = ["ADMIN", "OWNER", "MANAGER"].includes(membership.role);
  return (
    <>
      <ServerOrderCompletionAlerts restaurantId={membership.restaurant_id} />
      <OrdersView
        canMonitorOrders={canMonitorOrders}
        historyRange={historyRange}
        historicalOrders={historicalOrders}
        menuItems={menuItems || []}
        orders={recentOrders}
        paymentOptions={paymentOptions}
        tables={tables || []}
      />
    </>
  );
}