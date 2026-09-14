"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/app/i18n/LanguageProvider";

const roles = {
  ADMIN: "Admin",
  OWNER: "Owner",
  MANAGER: "Manager",
  SERVER: "Server",
  CHEF: "Chef",
  BARMAN: "Barman",
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "ETB",
  currencyDisplay: "code",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

function formatMoney(value) {
  return money.format(Number(value || 0));
}

function Metric({ label, value, detail, muted = false }) {
  return (
    <article className={`metric-card${muted ? " metric-card-muted" : ""}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function SalesSummary({ values, t }) {
  const days = Object.entries(values).sort(([a], [b]) => a.localeCompare(b));

  const maximum = Math.max(...days.map(([, value]) => value), 1);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t("last7Days")}</p>
          <h2>{t("salesSummary")}</h2>
        </div>

        <span className="panel-note">{t("completedPayments")}</span>
      </div>

      {days.length === 0 ? (
        <p className="empty-copy">{t("noCompletedPaymentData")}</p>
      ) : (
        <div className="sales-bars">
          {days.map(([day, value]) => (
            <div className="sales-bar-group" key={day}>
              <div className="sales-bar-track">
                <div
                  className="sales-bar"
                  style={{
                    height: `${Math.max((value / maximum) * 100, 5)}%`,
                  }}
                />
              </div>

              <span>
                {new Date(`${day}T12:00:00`).toLocaleDateString("en-US", {
                  weekday: "short",
                })}
              </span>

              <small>{formatMoney(value)}</small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function DashboardClient({ data }) {
  const { t } = useLanguage();
  const [selectedOrder, setSelectedOrder] = useState(null);

  const tableName = (order) => {
    const table = Array.isArray(order.tables)
      ? order.tables[0]
      : order.tables;

    return (
      table?.name ||
      (table?.table_number
        ? `${t("table")} ${table.table_number}`
        : t("takeaway"))
    );
  };

  const roleLabel = roles[data.role]
    ? t(`role${data.role}`)
    : data.role;

  const today = new Date();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">ADDIS RMS</span>
          <span className="brand-tagline">
            RUN SMARTER. GROW FASTER.
          </span>
        </div>

        <nav aria-label={t("mainNavigation")}>
          <Link className="nav-link nav-link-active" href="/">
            {t("overview")}
          </Link>

          <Link className="nav-link" href="/orders">
            {t("orders")}
          </Link>

          {data.canViewTables && (
            <Link className="nav-link" href="/tables">
              {t("tables")}
            </Link>
          )}

          <Link className="nav-link" href="/menu">
            {t("menu")}
          </Link>

          {data.role !== "MANAGER" && (
            <Link className="nav-link" href="/staff">
              {t("staff")}
            </Link>
          )}

          {data.canManageSettings && (
            <Link className="nav-link" href="/admin/settings">
              {t("settings")}
            </Link>
          )}
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" />
          {t("supabaseConnected")}
        </div>
      </aside>

      <main className="dashboard-main" id="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {today.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>

            <h1>{data.restaurantName}</h1>
          </div>

          <div className="user-chip">
            <span className="avatar">
              {roles[data.role]?.slice(0, 1) || "S"}
            </span>

            <span>
              <strong>{roleLabel}</strong>
              <small>{t("staffAccess")}</small>
            </span>
          </div>
        </header>

        <section className="welcome-row">
          <div>
            <p className="eyebrow">{t("operationsOverview")}</p>

            <h2>{t("floorPulse")}</h2>
          </div>

          <span className="live-pill">
            <span className="status-dot" />
            {t("liveData")}
          </span>
        </section>

        <section className="metric-grid">
          <Metric
            label={t("todaysSales")}
            value={
              data.canViewFinancials
                ? formatMoney(data.sales)
                : t("restricted")
            }
            detail={
              data.canViewFinancials
                ? t("completedPayments")
                : t("availableToFinanceRoles")
            }
            muted={!data.canViewFinancials}
          />

          <Metric
            label={t("todaysOrders")}
            value={data.orders.length}
            detail={t("allOrderStatuses")}
          />

          <Metric
            label={t("pendingOrders")}
            value={data.pendingOrders}
            detail={t("activeServiceQueue")}
          />

          <Metric
            label={t("completedOrders")}
            value={data.completedOrders}
            detail={t("closedToday")}
          />
        </section>

        {data.canViewTables && (
          <section className="metric-grid compact-grid">
            <Metric
              label={t("availableTables")}
              value={`${data.availableTables} / ${data.totalTables}`}
              detail={t("readyForGuests")}
            />

            <Metric
              label={t("occupiedTables")}
              value={`${data.occupiedTables} / ${data.totalTables}`}
              detail={t("currentlySeated")}
            />

            <Metric
              label={t("reservedTables")}
              value={`${data.reservedTables} / ${data.totalTables}`}
              detail={t("reservedForGuests")}
            />

            <Metric
              label={t("cleaningTables")}
              value={`${data.cleaningTables} / ${data.totalTables}`}
              detail={t("beingCleaned")}
            />
          </section>
        )}

        <div className="content-grid">
          {data.canViewFinancials && (
            <SalesSummary values={data.salesByDay} t={t} />
          )}

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{t("today")}</p>
                <h2>{t("bestSellingItems")}</h2>
              </div>
            </div>

            {data.bestSelling.length === 0 ? (
              <p className="empty-copy">{t("noItemSalesToday")}</p>
            ) : (
              <div className="rank-list">
                {data.bestSelling.map(([name, quantity], index) => (
                  <div className="rank-row" key={name}>
                    <span className="rank-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <strong>{name}</strong>

                    <span>
                      {quantity} {t("sold")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="panel orders-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{t("latestActivity")}</p>
              <h2>{t("recentOrders")}</h2>
            </div>

            <span className="panel-note">
              {data.orders.length} {t("today")}
            </span>
          </div>

          {data.orders.length === 0 ? (
            <p className="empty-copy">{t("noOrdersToday")}</p>
          ) : (
            <div className="orders-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ORDER #</th>
<th>TABLE / SEAT</th>
<th>SERVER</th>
<th>ITEMS</th>
<th>AMOUNT</th>
<th>STATUS</th>
<th>TIME</th>
                  </tr>
                </thead>

                <tbody>
  {data.orders.slice(0, 8).map((order) => (
    <tr
      key={order.id}
      onClick={() => setSelectedOrder(order)}
      style={{ cursor: "pointer" }}
    >
      <td>
        <strong>{order.order_number}</strong>
      </td>

      <td>
        {order.tables?.name ||
          (order.tables?.table_number
            ? `Table ${order.tables.table_number}`
            : "—")}
      </td>

      <td>{order.serverName || "Not assigned"}</td>

      <td>
        {order.items?.length
          ? `${order.items.reduce(
              (total, item) => total + Number(item.quantity || 0),
              0
            )} items`
          : "—"}
      </td>

      <td>
        ETB {Number(order.total || 0).toLocaleString()}
      </td>

      <td>{order.status}</td>

      <td>
        {new Date(order.created_at).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })}
      </td>
    </tr>
  ))}
</tbody>
              </table>
            </div>
          )}
        </section>
           </main>

      {selectedOrder && (
        <div className="order-modal-backdrop">
          <div className="order-modal">
            <div className="order-modal-header">
              <div>
                <p className="eyebrow">ORDER DETAILS</p>
                <h2>{selectedOrder.order_number}</h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="order-modal-close"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="order-details-grid">
              <div>
                <span>Table / Seat</span>
                <strong>{tableName(selectedOrder)}</strong>
              </div>

              <div>
                <span>Server</span>
                <strong>
                  {selectedOrder.serverName || "Not assigned"}
                </strong>
              </div>

              <div>
                <span>Order type</span>
                <strong>—</strong>
              </div>

              <div>
                <span>Created</span>
                <strong>
                  {new Date(
                    selectedOrder.created_at
                  ).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <strong>{selectedOrder.status}</strong>
              </div>
            </div>

            <div className="order-modal-items">
              <h3>Items</h3>

              {selectedOrder.items?.length ? (
                selectedOrder.items.map((item, index) => (
                  <div className="order-item-row" key={`${item.name}-${index}`}>
                    <span>{item.name}</span>
                    <strong>× {item.quantity}</strong>
                  </div>
                ))
              ) : (
                <p className="empty-copy">No items found.</p>
              )}
            </div>

            <div className="order-modal-total">
              <span>Total</span>
              <strong>
                ETB{" "}
                {Number(selectedOrder.total || 0).toLocaleString()}
              </strong>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}