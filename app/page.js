import Link from "next/link";
import DashboardClient from "@/app/admin/DashboardClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext, getRoleHome } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "ETB",
  currencyDisplay: "code",
});

const date = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

const time = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const roles = {
  ADMIN: "Admin",
  OWNER: "Owner",
  MANAGER: "Manager",
  SERVER: "Server",
  CHEF: "Chef",
  BARMAN: "Barman",
};

const activeStatuses = new Set([
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "SERVED",
]);

function formatMoney(value) {
  return money.format(Number(value || 0));
}

function startOfDay(value) {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(value) {
  const result = new Date(value);
  result.setHours(23, 59, 59, 999);
  return result;
}

async function loadDashboard() {
  const supabase = await createSupabaseServerClient();

  const { user, membership } = await getAuthContext(supabase);

  if (!user) {
    return { state: "unauthenticated" };
  }

  if (!membership) {
    return { state: "unauthorized" };
  }

  if (["SERVER", "CHEF", "BARMAN"].includes(membership.role)) {
    redirect(getRoleHome(membership.role));
  }

  const restaurant = Array.isArray(membership.restaurants)
    ? membership.restaurants[0]
    : membership.restaurants;

  const today = new Date();

  const todayStart = startOfDay(today).toISOString();
  const todayEnd = endOfDay(today).toISOString();

  const historyStart = new Date(startOfDay(today));
  historyStart.setDate(historyStart.getDate() - 6);

  const canViewFinancials = [
    "ADMIN",
    "OWNER",
    "MANAGER",
    "SERVER",
  ].includes(membership.role);

  const canViewTables = [
    "ADMIN",
    "OWNER",
    "MANAGER",
    "SERVER",
  ].includes(membership.role);

  const canManageSettings = [
    "ADMIN",
    "OWNER",
  ].includes(membership.role);

  const requests = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, total, status, created_at, tables(table_number, name)"
      )
      .eq("restaurant_id", membership.restaurant_id)
      .gte("created_at", todayStart)
      .lte("created_at", todayEnd)
      .order("created_at", { ascending: false })
      .limit(50),

    canViewTables
      ? supabase
          .from("tables")
          .select("status")
          .eq("restaurant_id", membership.restaurant_id)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    supabase
      .from("order_items")
      .select(
        "quantity, menu_items(name), orders!inner(restaurant_id, created_at, status)"
      )
      .eq("restaurant_id", membership.restaurant_id)
      .eq("orders.restaurant_id", membership.restaurant_id)
      .gte("orders.created_at", todayStart)
      .lte("orders.created_at", todayEnd)
      .neq("orders.status", "CANCELLED"),

    canViewFinancials
      ? supabase
          .from("payments")
          .select("amount, created_at, orders!inner(status)")
          .eq("restaurant_id", membership.restaurant_id)
          .eq("status", "COMPLETED")
          .neq("orders.status", "CANCELLED")
          .gte("created_at", todayStart)
          .lte("created_at", todayEnd)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    canViewFinancials
      ? supabase
          .from("payments")
          .select("amount, created_at, orders!inner(status)")
          .eq("restaurant_id", membership.restaurant_id)
          .eq("status", "COMPLETED")
          .neq("orders.status", "CANCELLED")
          .gte("created_at", historyStart.toISOString())
          .lte("created_at", todayEnd)
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  const queryError = requests.find(
    (result) => result.error
  )?.error;

  if (queryError) {
    throw queryError;
  }

  const [
    ordersResult,
    tablesResult,
    itemsResult,
    paymentsResult,
    historyResult,
  ] = requests;

  const orders = ordersResult.data || [];

  const tableStatuses = (tablesResult.data || []).map(
    (table) => table.status
  );

  const totalTables = tableStatuses.length;

  const itemTotals = (itemsResult.data || []).reduce(
    (totals, item) => {
      const name =
        item.menu_items?.name || "Unnamed item";

      totals[name] =
        (totals[name] || 0) +
        Number(item.quantity || 0);

      return totals;
    },
    {}
  );

  const salesByDay = (
    historyResult.data || []
  ).reduce((totals, payment) => {
    const day = payment.created_at.slice(0, 10);

    totals[day] =
      (totals[day] || 0) +
      Number(payment.amount || 0);

    return totals;
  }, {});

  return {
    state: "ready",

    restaurantName:
      restaurant?.name || "Your restaurant",

    role: membership.role,

    canViewFinancials,

    canViewTables,

    canManageSettings,

    orders,

    sales: (paymentsResult.data || []).reduce(
      (total, payment) =>
        total + Number(payment.amount || 0),
      0
    ),

    pendingOrders: orders.filter((order) =>
      activeStatuses.has(order.status)
    ).length,

    completedOrders: orders.filter(
      (order) => order.status === "COMPLETED"
    ).length,

    totalTables,

    availableTables: tableStatuses.filter(
      (status) => status === "AVAILABLE"
    ).length,

    occupiedTables: tableStatuses.filter(
      (status) => status === "OCCUPIED"
    ).length,

    reservedTables: tableStatuses.filter(
      (status) => status === "RESERVED"
    ).length,

    cleaningTables: tableStatuses.filter(
      (status) => status === "CLEANING"
    ).length,

    bestSelling: Object.entries(itemTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5),

    salesByDay,
  };
}

function StateMessage({ title, message }) {
  return (
    <main className="state-page">
      <div className="state-panel">
        <span className="brand-mark">
          ADDIS RMS
        </span>

        <p className="eyebrow">
          RUN SMARTER. GROW FASTER.
        </p>

        <h1>{title}</h1>

        <p>{message}</p>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  detail,
  muted = false,
}) {
  return (
    <article
      className={`metric-card${
        muted ? " metric-card-muted" : ""
      }`}
    >
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function SalesSummary({ values }) {
  const days = Object.entries(values).sort(
    ([a], [b]) => a.localeCompare(b)
  );

  const maximum = Math.max(
    ...days.map(([, value]) => value),
    1
  );

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            Last 7 days
          </p>

          <h2>Sales summary</h2>
        </div>

        <span className="panel-note">
          Completed payments
        </span>
      </div>

      {days.length === 0 ? (
        <p className="empty-copy">
          No completed payment data for this period.
        </p>
      ) : (
        <div className="sales-bars">
          {days.map(([day, value]) => (
            <div
              className="sales-bar-group"
              key={day}
            >
              <div className="sales-bar-track">
                <div
                  className="sales-bar"
                  style={{
                    height: `${Math.max(
                      (value / maximum) * 100,
                      5
                    )}%`,
                  }}
                />
              </div>

              <span>
                {new Date(
                  `${day}T12:00:00`
                ).toLocaleDateString("en-US", {
                  weekday: "short",
                })}
              </span>

              <small>
                {formatMoney(value)}
              </small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Dashboard({ data }) {
  const tableName = (order) => {
    const table = Array.isArray(order.tables)
      ? order.tables[0]
      : order.tables;

    return (
      table?.name ||
      (table?.table_number
        ? `Table ${table.table_number}`
        : "Takeaway")
    );
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">
            ADDIS RMS
          </span>

          <span className="brand-tagline">
            RUN SMARTER. GROW FASTER.
          </span>
        </div>

        <nav aria-label="Main navigation">
          <Link
            className="nav-link nav-link-active"
            href="/"
          >
            Overview
          </Link>

          <Link
            className="nav-link"
            href="/orders"
          >
            Orders
          </Link>

          {data.canViewTables && (
            <Link
              className="nav-link"
              href="/tables"
            >
              Tables
            </Link>
          )}

          <Link className="nav-link" href="/menu">Menu</Link>

          {data.role !== "MANAGER" && (
            <Link className="nav-link" href="/staff">Staff</Link>
          )}

          {data.canManageSettings && (
            <Link className="nav-link" href="/admin/settings">Settings</Link>
          )}

</nav>

        <div className="sidebar-footer">
          <span className="status-dot" />
          Supabase connected
        </div>
      </aside>

      <main
        className="dashboard-main"
        id="dashboard"
      >
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {date.format(new Date())}
            </p>

            <h1>{data.restaurantName}</h1>
          </div>

          <div className="user-chip">
            <span className="avatar">
              {roles[data.role]?.slice(0, 1) ||
                "S"}
            </span>

            <span>
              <strong>
                {roles[data.role] || data.role}
              </strong>

              <small>Staff access</small>
            </span>
          </div>
        </header>

        <section className="welcome-row">
          <div>
            <p className="eyeOperations overviewbrow">
              
            </p>

            <h2>
              Good day. Here is the pulse of your
              floor.
            </h2>
          </div>

          <span className="live-pill">
            <span className="status-dot" />
            Live data
          </span>
        </section>

        <section className="metric-grid">
          <Metric
            label="Today's sales"
            value={
              data.canViewFinancials
                ? formatMoney(data.sales)
                : "Restricted"
            }
            detail={
              data.canViewFinancials
                ? "Completed payments"
                : "Available to finance roles"
            }
            muted={!data.canViewFinancials}
          />

          <Metric
            label="Today's orders"
            value={data.orders.length}
            detail="All order statuses"
          />

          <Metric
            label="Pending orders"
            value={data.pendingOrders}
            detail="Active service queue"
          />

          <Metric
            label="Completed orders"
            value={data.completedOrders}
            detail="Closed today"
          />
        </section>

        {data.canViewTables && (
          <section className="metric-grid compact-grid">
            <Metric
              label="Available tables"
              value={`${data.availableTables} / ${data.totalTables}`}
              detail="Ready for guests"
            />

            <Metric
              label="Occupied tables"
              value={`${data.occupiedTables} / ${data.totalTables}`}
              detail="Currently seated"
            />

            <Metric
              label="Reserved tables"
              value={`${data.reservedTables} / ${data.totalTables}`}
              detail="Reserved for guests"
            />

            <Metric
              label="Cleaning tables"
              value={`${data.cleaningTables} / ${data.totalTables}`}
              detail="Being cleaned"
            />
          </section>
        )}

        <div className="content-grid">
          {data.canViewFinancials && (
            <SalesSummary
              values={data.salesByDay}
            />
          )}

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">
                  Today
                </p>

                <h2>Best-selling items</h2>
              </div>
            </div>

            {data.bestSelling.length === 0 ? (
              <p className="empty-copy">
                No item sales recorded today.
              </p>
            ) : (
              <div className="rank-list">
                {data.bestSelling.map(
                  ([name, quantity], index) => (
                    <div
                      className="rank-row"
                      key={name}
                    >
                      <span className="rank-number">
                        0{index + 1}
                      </span>

                      <strong>{name}</strong>

                      <span>
                        {quantity} sold
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        </div>

        <section className="panel orders-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                Latest activity
              </p>

              <h2>Recent orders</h2>
            </div>

            <span className="panel-note">
              {data.orders.length} today
            </span>
          </div>

          {data.orders.length === 0 ? (
            <p className="empty-copy">
              No orders have been recorded today.
            </p>
          ) : (
            <div className="orders-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Table</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Time</th>
                  </tr>
                </thead>

                <tbody>
                  {data.orders
                    .slice(0, 8)
                    .map((order) => (
                      <tr key={order.id}>
                        <td className="order-number">
                          {order.order_number}
                        </td>

                        <td>
                          {tableName(order)}
                        </td>

                        <td>
                          {formatMoney(order.total)}
                        </td>

                        <td>
                          <span
                            className={`status-badge status-${order.status?.toLowerCase()}`}
                          >
                            {order.status?.toLowerCase()}
                          </span>
                        </td>

                        <td>
                          {time.format(
                            new Date(order.created_at)
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default async function Home() {
  let data;
  let errorMessage;
  let setupError = false;

  try {
    data = await loadDashboard();
  } catch (error) {
    if (error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }

    console.error("[dashboard] Failed to load dashboard data", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });

    setupError =
      error.message?.startsWith(
        "Supabase is not configured"
      );

    errorMessage = setupError
      ? error.message
      : "We could not load your restaurant data. Check the Supabase schema, RLS policies, and server logs before trying again.";
  }

  if (errorMessage) {
    return (
      <StateMessage
        title={
          setupError
            ? "Supabase setup required"
            : "Dashboard unavailable"
        }
        message={errorMessage}
      />
    );
  }

  if (data.state === "unauthenticated") {
    return (
      <StateMessage
        title="Sign in to continue"
        message="Your Supabase session is not active. Sign in through the configured Supabase Auth flow to view this restaurant dashboard."
      />
    );
  }

  if (data.state === "unauthorized") {
    return (
      <StateMessage
        title="Access not granted"
        message="Your account is authenticated, but it is not a member of a restaurant in ADDIS RMS."
      />
    );
  }

  return <Dashboard data={data} />;
}