import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import AuthenticatedSidebar from "@/app/admin/AuthenticatedSidebar";
import HistoryView from "./HistoryView";
import "./history.css";
import { getBusinessDateKey, toBusinessInstant } from "../staff/attendanceSelection";
import { businessDateKeyFor, shiftBusinessDate } from "@/lib/business-date.mjs";

export const dynamic = "force-dynamic";

const MANAGEMENT_ROLES = ["ADMIN", "OWNER", "MANAGER"];
const FINANCIAL_ROLES = ["ADMIN", "OWNER", "MANAGER", "SERVER"];
const RECORD_TYPES = ["ALL", "ORDER", "PAYMENT", "STOCK_MOVEMENT", "STOCK_REQUEST", "STATION"];
const PAGE_LIMIT = 50;
const PERIODS = [
  { value: "LAST_7_DAYS", labelKey: "historyLast7Days" },
  ...[1, 2, 3, 4].map((number) => ({ value: `WEEK_${number}`, labelKey: "historyWeek", number })),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((number) => ({ value: `MONTH_${number}`, labelKey: "historyMonth", number })),
  { value: "YEAR_1", labelKey: "historyYearOne" },
];

function toDate(value, endOfDay = false) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (businessDateKeyFor(year, month - 1, day) !== value) return null;
  const boundaryDate = endOfDay ? shiftBusinessDate(value, 1) : value;
  const instant = toBusinessInstant(boundaryDate, "00:00:00") - (endOfDay ? 1 : 0);
  return new Date(instant).toISOString();
}

function money(value) {
  return `ETB ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusClass(status) {
  return `history-status history-status-${String(status || "unknown").toLowerCase().replaceAll("_", "-")}`;
}

function matchesSearch(record, searchTerm) {
  if (!searchTerm) return true;
  return `${record.title} ${record.subtitle} ${record.details}`.toLowerCase().includes(searchTerm.toLowerCase());
}

function buildRecord(type, title, subtitle, details, status, station, createdAt, href = null, amount = 0, display = {}) {
  return { type, title, subtitle, details, status, station, createdAt, href, amount, display };
}

async function loadBestSellingItems(supabase, restaurantId, from, to) {
  const pageSize = 1000;
  const totalsByMenuItem = new Map();

  for (let offset = 0; ; offset += pageSize) {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, order_items!inner(menu_item_id, quantity, subtotal, menu_items(name, station)), payments!inner(status)")
      .eq("restaurant_id", restaurantId)
      .eq("order_items.restaurant_id", restaurantId)
      .eq("payments.restaurant_id", restaurantId)
      .in("status", ["PAID", "COMPLETED"])
      .eq("payments.status", "COMPLETED")
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);

    for (const order of orders || []) {
      for (const item of order.order_items || []) {
        if (!item.menu_item_id || !item.menu_items?.name) continue;
        const quantity = Number(item.quantity || 0);
        const totalSales = Number(item.subtotal || 0);
        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(totalSales)) continue;
        const current = totalsByMenuItem.get(item.menu_item_id) || {
          id: item.menu_item_id,
          name: item.menu_items.name,
          station: item.menu_items.station || "",
          quantitySold: 0,
          totalSales: 0,
        };
        current.quantitySold += quantity;
        current.totalSales += totalSales;
        totalsByMenuItem.set(item.menu_item_id, current);
      }
    }

    if ((orders || []).length < pageSize) break;
  }

  return [...totalsByMenuItem.values()]
    .sort((left, right) => right.quantitySold - left.quantitySold)
    .map((item) => ({ ...item, totalSales: money(item.totalSales) }));
}

export default async function HistoryPage({ searchParams = {} }) {
  const supabase = await createSupabaseServerClient();
  const { user, membership } = await getAuthContext(supabase);
  if (!user) redirect("/login");
  if (!membership) redirect("/");

  const resolvedSearchParams = await searchParams;
  const currentYear = Number(getBusinessDateKey().slice(0, 4));
  const requestedYear = Number(queryValue(resolvedSearchParams, "year"));
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= currentYear ? requestedYear : currentYear;
  const requestedPeriod = queryValue(resolvedSearchParams, "period");
  const period = PERIODS.some((option) => option.value === requestedPeriod) ? requestedPeriod : "LAST_7_DAYS";
  const periodDefinition = periodRange(period, year);

  const earliestTables = ["orders", "stock_movements", "stock_requests", "kitchen_orders"];
  if (FINANCIAL_ROLES.includes(membership.role)) earliestTables.push("payments");
  const earliestResults = await Promise.all(earliestTables.map((table) => supabase
    .from(table)
    .select("created_at")
    .eq("restaurant_id", membership.restaurant_id)
    .order("created_at", { ascending: true })
    .limit(1)));
  const earliestError = earliestResults.find((result) => result.error)?.error;
  if (earliestError) throw new Error(earliestError.message);
  const earliestYear = earliestResults.map((result) => result.data?.[0]?.created_at).filter(Boolean)
    .map((value) => Number(getBusinessDateKey(new Date(value)).slice(0, 4)))
    .reduce((minimum, value) => Math.min(minimum, value), currentYear);
  const availableYears = Array.from({ length: currentYear - earliestYear + 1 }, (_, index) => currentYear - index);

  const type = RECORD_TYPES.includes(String(queryValue(resolvedSearchParams, "type") || "").toUpperCase())
    ? String(queryValue(resolvedSearchParams, "type") || "").toUpperCase()
    : "ALL";
  const status = String(queryValue(resolvedSearchParams, "status") || "").trim().toUpperCase();
  const station = ["KITCHEN", "BAR"].includes(String(queryValue(resolvedSearchParams, "station") || "").toUpperCase())
    ? String(queryValue(resolvedSearchParams, "station") || "").toUpperCase()
    : "";
  const searchValue = queryValue(resolvedSearchParams, "q");
  const search = typeof searchValue === "string" ? searchValue.trim() : "";
  const customFrom = toDate(queryValue(resolvedSearchParams, "from"));
  const customTo = toDate(queryValue(resolvedSearchParams, "to"), true);
  const from = customFrom || periodDefinition.start;
  const to = customTo || periodDefinition.end;
  const dateFilter = (query, limit = PAGE_LIMIT) => {
    let next = query;
    if (from) next = next.gte("created_at", from);
    if (to) next = next.lte("created_at", to);
    next = next.order("created_at", { ascending: false });
    return limit === null ? next : next.limit(limit);
  };

  const include = (recordType) => type === "ALL" || type === recordType;
  const queries = [];
  const queryNames = [];

  if (include("ORDER")) {
    let query = supabase
      .from("orders")
      .select("id, order_number, total, status, notes, created_at, table_id, tables(table_number, name)")
      .eq("restaurant_id", membership.restaurant_id);
    if (search) query = query.or(`order_number.ilike.%${search}%,notes.ilike.%${search}%`);
    queries.push(dateFilter(query));
    queryNames.push("orders");
  }

  if (include("PAYMENT") && FINANCIAL_ROLES.includes(membership.role)) {
    queries.push(dateFilter(
      supabase.from("payments")
        .select("id, order_id, amount, method, status, reference_number, created_at, orders(order_number)")
        .eq("restaurant_id", membership.restaurant_id),
      null,
    ));
    queryNames.push("payments");
  }

  if (include("STOCK_MOVEMENT")) {
    queries.push(dateFilter(
      supabase.from("stock_movements")
        .select("id, movement_type, quantity_delta, unit, reason, previous_quantity, new_quantity, created_at, performed_by_user_id, inventory_items(name, station)")
        .eq("restaurant_id", membership.restaurant_id)
    ));
    queryNames.push("movements");
  }

  if (include("STOCK_REQUEST")) {
    queries.push(dateFilter(
      supabase.from("stock_requests")
        .select("id, status, quantity, unit, note, created_at, updated_at, reviewed_at, requested_by_user_id, inventory_items(name, station)")
        .eq("restaurant_id", membership.restaurant_id)
    ));
    queryNames.push("requests");
  }

  if (include("STATION")) {
    queries.push(dateFilter(
      supabase.from("kitchen_orders")
        .select("id, station, status, created_at, updated_at, orders(order_number)")
        .eq("restaurant_id", membership.restaurant_id)
    ));
    queryNames.push("stations");
  }

  const bestSellingPromise = FINANCIAL_ROLES.includes(membership.role)
    ? loadBestSellingItems(supabase, membership.restaurant_id, from, to)
    : Promise.resolve([]);

  const [results, bestSellingItems] = await Promise.all([
    Promise.all(queries),
    bestSellingPromise,
  ]);
  const queryError = results.find((result) => result.error)?.error;
  if (queryError) throw new Error(queryError.message);
  const dataByName = new Map(queryNames.map((name, index) => [name, results[index].data || []]));
  const requestRows = dataByName.get("requests") || [];
  const requesterIds = [...new Set(requestRows.map((request) => request.requested_by_user_id).filter(Boolean))];
  const profilesResult = requesterIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", requesterIds)
    : { data: [], error: null };
  if (profilesResult.error) throw new Error(profilesResult.error.message);
    const profileNames = new Map((profilesResult.data || []).map((profile) => [profile.id, profile.full_name || ""]));
  const records = [];

  for (const order of dataByName.get("orders") || []) {
    const location = order.tables?.name || (order.tables?.table_number ? String(order.tables.table_number) : "");
    const orderType = order.notes?.split(" | ")[0] || "DINE_IN";
    records.push(buildRecord(
      "ORDER",
      order.order_number || order.id,
      `${location} ${orderType}`,
      money(order.total),
      order.status,
      "",
      order.created_at,
      `/receipts/${order.id}`,
      0,
      { kind: "order", locationName: order.tables?.name || "", tableNumber: order.tables?.table_number || "", orderType },
    ));
  }
  for (const payment of dataByName.get("payments") || []) {
    records.push(buildRecord("PAYMENT", payment.orders?.order_number || payment.order_id, payment.method, `${money(payment.amount)}${payment.reference_number ? ` · ${payment.reference_number}` : ""}`, payment.status, "", payment.created_at, `/receipts/${payment.order_id}`, Number(payment.amount || 0), { kind: "payment", method: payment.method }));
  }
  for (const movement of dataByName.get("movements") || []) {
    records.push(buildRecord("STOCK_MOVEMENT", movement.inventory_items?.name || "", movement.movement_type, `${movement.quantity_delta > 0 ? "+" : ""}${movement.quantity_delta} ${movement.unit} · ${movement.reason || ""}`, movement.movement_type, movement.inventory_items?.station || "", movement.created_at, "/inventory", 0, { kind: "movement", movementType: movement.movement_type, delta: movement.quantity_delta, unit: movement.unit, reason: movement.reason, fallbackTitle: !movement.inventory_items?.name }));
  }
  for (const request of requestRows) {
    const requestStation = request.inventory_items?.station || "";
    const requestedBy = profileNames.get(request.requested_by_user_id) || "";
    records.push(buildRecord("STOCK_REQUEST", request.inventory_items?.name || "", `${requestStation} ${request.quantity} ${request.unit} ${requestedBy}`, `${request.note || ""} ${request.created_at} ${request.updated_at || ""}`, request.status, requestStation, request.created_at, "/inventory", 0, { kind: "request", station: requestStation, quantity: request.quantity, unit: request.unit, requestedBy, note: request.note, createdAt: request.created_at, updatedAt: request.updated_at || "", fallbackTitle: !request.inventory_items?.name }));
  }
  for (const stationOrder of dataByName.get("stations") || []) {
    records.push(buildRecord("STATION", stationOrder.orders?.order_number || stationOrder.id, stationOrder.station, "", stationOrder.status, stationOrder.station, stationOrder.updated_at || stationOrder.created_at, stationOrder.station === "BAR" ? "/bar" : "/kitchen", 0, { kind: "station", station: stationOrder.station }));
  }

  const filteredRecords = records
    .filter((record) => !status || record.status === status)
    .filter((record) => !station || record.station === station)
    .filter((record) => matchesSearch(record, search))
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

  const summary = {
    total: filteredRecords.length,
    orders: filteredRecords.filter((record) => record.type === "ORDER").length,
    completedOrders: filteredRecords.filter((record) => record.type === "ORDER" && ["COMPLETED", "PAID"].includes(record.status)).length,
    requests: filteredRecords.filter((record) => record.type === "STOCK_REQUEST").length,
    payments: filteredRecords.filter((record) => record.type === "PAYMENT").length,
    revenue: filteredRecords.filter((record) => record.type === "PAYMENT" && record.status === "COMPLETED").reduce((total, record) => total + record.amount, 0),
    movements: filteredRecords.filter((record) => record.type === "STOCK_MOVEMENT").length,
    kitchen: filteredRecords.filter((record) => record.type === "STATION" && record.station === "KITCHEN").length,
    bar: filteredRecords.filter((record) => record.type === "STATION" && record.station === "BAR").length,
  };
  const canViewTables = ["ADMIN", "OWNER", "MANAGER", "SERVER"].includes(membership.role);
  const canManageSettings = ["ADMIN", "OWNER"].includes(membership.role);
  return (
    <div className="app-shell history-app-shell">
      <AuthenticatedSidebar role={membership.role} canViewTables={canViewTables} canManageSettings={canManageSettings} />
      <HistoryView
        availableYears={availableYears}
        filters={{
          canViewFinancials: FINANCIAL_ROLES.includes(membership.role),
          displayFrom: from,
          displayTo: to,
          from: queryValue(resolvedSearchParams, "from") || "",
          to: queryValue(resolvedSearchParams, "to") || "",
          search,
          station,
          status,
          type,
        }}
        hasRecords={records.length > 0}
        period={period}
        periodDefinition={periodDefinition}
        periods={PERIODS}
        bestSellingItems={bestSellingItems}
        records={filteredRecords.map((record) => ({ ...record, statusClass: statusClass(record.status) }))}
        summary={{ ...summary, revenue: money(summary.revenue) }}
        year={year}
      />
    </div>
  );
}

function businessDateRange(startDate, endDateExclusive) {
  return {
    start: new Date(toBusinessInstant(startDate, "00:00:00")).toISOString(),
    end: new Date(toBusinessInstant(endDateExclusive, "00:00:00") - 1).toISOString(),
  };
}

function periodRange(period, year) {
  if (period === "LAST_7_DAYS") {
    const today = getBusinessDateKey();
    const bounds = businessDateRange(shiftBusinessDate(today, -6), shiftBusinessDate(today, 1));
    return { ...bounds, labelKey: "historyLast7Days" };
  }
  if (period === "YEAR_1") {
    return {
      ...businessDateRange(`${year}-01-01`, `${year + 1}-01-01`),
      labelKey: "historyYearOne",
    };
  }
  const monthMatch = /^MONTH_(\d+)$/.exec(period);
  if (monthMatch) {
    const month = Number(monthMatch[1]) - 1;
    return {
      ...businessDateRange(businessDateKeyFor(year, month, 1), businessDateKeyFor(year, month + 1, 1)),
      labelKey: "historyMonth",
      number: month + 1,
    };
  }
  const weekMatch = /^WEEK_(\d+)$/.exec(period);
  if (weekMatch) {
    const startDay = ((Number(weekMatch[1]) - 1) * 7) + 1;
    const startDate = businessDateKeyFor(year, 0, startDay);
    return {
      ...businessDateRange(startDate, shiftBusinessDate(startDate, 7)),
      labelKey: "historyWeek",
      number: Number(weekMatch[1]),
    };
  }
  return periodRange("LAST_7_DAYS", year);
}

function queryValue(searchParams, key) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
}