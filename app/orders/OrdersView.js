"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createOrder, recordPayment } from "./actions";
import { useLanguage } from "../i18n/LanguageProvider";
import { BUSINESS_TIME_ZONE } from "@/lib/business-date.mjs";

const ORDER_STATUS_KEYS = {
  NEW: "NEW",
  CONFIRMED: "historyStatusConfirmed",
  PREPARING: "PREPARING",
  READY: "READY",
  SERVED: "historyStatusServed",
  COMPLETED: "COMPLETED",
  CANCELLED: "historyStatusCancelled",
  PAID: "historyStatusPaid",
};

const PAYMENT_STATUS_KEYS = {
  COMPLETED: "historyStatusPaid",
  PENDING: "historyStatusPending",
  FAILED: "historyStatusFailed",
  REFUNDED: "historyStatusRefunded",
  UNPAID: "unpaid",
};

const ORDER_ERROR_KEYS = {
  "You must be signed in.": "settingsSignInRequired",
  "You do not have permission to create orders.": "ordersCreatePermissionDenied",
  "Choose a menu item and a positive quantity.": "ordersMenuQuantityRequired",
  "That menu item is not available.": "ordersMenuItemUnavailable",
  "That table does not belong to this restaurant.": "ordersTableInvalid",
  "The order total must be greater than zero.": "invalidOrderTotalError",
};

const PAYMENT_ERROR_KEYS = {
  "You must be signed in.": "settingsSignInRequired",
  "You do not have permission to record payments.": "ordersPaymentPermissionDenied",
  "Enter a valid amount and payment method.": "invalidPaymentError",
  "This payment method is not enabled for this restaurant.": "disabledPaymentError",
  "Order not found.": "ordersOrderNotFound",
  "Cancelled orders cannot be paid.": "ordersCancelledCannotPay",
  "A transaction reference is required for this payment method.": "referenceRequiredError",
  "Cash received must be sufficient for the order total.": "cashInsufficientError",
  "This order has already been paid.": "alreadyPaidError",
  "An active payment already exists for this order.": "activePaymentExistsError",
  "The order could not be marked paid.": "ordersPaymentFinalizationFailed",
};

const HISTORY_RANGES = [
  { value: "LAST_7_DAYS", labelKey: "historyLast7Days" },
  { value: "THIS_WEEK", labelKey: "ordersThisWeek" },
  { value: "ALL", labelKey: "ordersAllHistory" },
];

const ACTION_INITIAL_STATE = { success: false, errorKey: "" };
const DATE_LOCALES = { en: "en-US", am: "am-ET", om: "om-ET", ti: "ti-ET" };

function formatAmount(value, locale) {
  return Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 2 });
}

function formatTime(value, locale) {
  return new Date(value).toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
  });
}

function formatDateTime(value, locale) {
  return new Date(value).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BUSINESS_TIME_ZONE,
  });
}

function orderStatusLabel(status, t) {
  return t(ORDER_STATUS_KEYS[status] || status || "historyStatusRecorded");
}

function paymentStatusLabel(status, t) {
  return t(PAYMENT_STATUS_KEYS[status] || status || "unpaid");
}

function orderTypeLabel(value, t) {
  const keys = { DINE_IN: "dineIn", TAKEAWAY: "takeaway", DELIVERY: "delivery" };
  return keys[value] ? t(keys[value]) : value;
}

function paymentMethodLabel(method, t) {
  const keys = {
    CASH: "cash",
    TELEBIRR: "telebirr",
  };
  if (method === "BANK_TRANSFER") return `${t("cbe")} / ${t("historyBankTransferMethod")}`;
  return keys[method] ? t(keys[method]) : method;
}

function tableLabel(order, t) {
  if (order.tables?.name) return order.tables.name;
  if (order.tables?.table_number) return `${t("table")} ${order.tables.table_number}`;
  return t("takeaway");
}

function orderErrorKey(error) {
  if (ORDER_ERROR_KEYS[error?.message]) return ORDER_ERROR_KEYS[error.message];
  if (error?.message?.startsWith("Menu item ") && error.message.endsWith(" has an invalid station.")) {
    return "ordersInvalidMenuItemStation";
  }
  return "unableCreateOrder";
}

function paymentErrorKey(error) {
  return PAYMENT_ERROR_KEYS[error?.message] || "unableRecordPayment";
}

function OrderMonitor({ orders, locale, t }) {
  const groupedOrders = ["NEW", "PREPARING", "COMPLETED"].map((status) => ({
    status,
    orders: orders.filter((order) => order.status === status),
  }));
  const otherOrders = orders.filter((order) => !["NEW", "PREPARING", "COMPLETED"].includes(order.status));

  return (
    <section className="orders-monitoring">
      <div className="orders-monitoring-heading">
        <div>
          <p className="eyebrow">{t("operations")}</p>
          <h2>{t("recentOrders")}</h2>
        </div>
        <span className="panel-note">{`${orders.length} ${t("storedOrders")}`}</span>
      </div>
      <div className="orders-monitoring-grid">
        {groupedOrders.map(({ status, orders: statusOrders }) => (
          <section className={`orders-status-column orders-status-${status.toLowerCase()}`} key={status}>
            <div className="orders-status-heading"><strong>{orderStatusLabel(status, t)}</strong><span>{statusOrders.length}</span></div>
            {statusOrders.length ? statusOrders.map((order) => (
              <article className="orders-monitor-card" key={order.id}>
                <strong>{order.order_number}</strong>
                <span>{formatTime(order.created_at, locale)}</span>
                <span>{tableLabel(order, t)} · {orderTypeLabel(order.orderType, t)}</span>
                <span>{`ETB ${formatAmount(order.total, locale)} · ${paymentStatusLabel(order.payment?.status || "UNPAID", t)}`}</span>
                <small>{order.items?.map((item) => `${item.quantity} × ${item.name || t("menuItem")}`).join(", ") || t("ordersNoItems")}</small>
              </article>
            )) : <p className="orders-monitor-empty">{t("noStatusOrders").replace("{status}", orderStatusLabel(status, t))}</p>}
          </section>
        ))}
        {otherOrders.length > 0 && (
          <section className="orders-status-column orders-status-other">
            <div className="orders-status-heading"><strong>{t("ordersOtherStatus")}</strong><span>{otherOrders.length}</span></div>
            {otherOrders.map((order) => (
              <article className="orders-monitor-card" key={order.id}>
                <strong>{order.order_number}</strong>
                <span>{orderStatusLabel(order.status, t)}</span>
                <span>{tableLabel(order, t)} · {orderTypeLabel(order.orderType, t)}</span>
                <span>{`ETB ${formatAmount(order.total, locale)} · ${paymentStatusLabel(order.payment?.status || "UNPAID", t)}`}</span>
              </article>
            ))}
          </section>
        )}
      </div>
    </section>
  );
}

function OrderHistory({ orders, range, locale, t }) {
  return (
    <section className="orders-history">
      <div className="orders-history-heading">
        <div>
          <p className="eyebrow">{t("history")}</p>
          <h2>{t("ordersHistoryTitle")}</h2>
        </div>
        <span className="panel-note">{`${orders.length} ${t("ordersCountLabel")}`}</span>
      </div>

      <nav className="orders-history-filters" aria-label={t("ordersHistoryTitle")}>
        {HISTORY_RANGES.map((option) => (
          <Link
            className={range === option.value ? "active" : ""}
            href={`/orders?historyRange=${option.value}`}
            key={option.value}
          >
            {t(option.labelKey)}
          </Link>
        ))}
      </nav>

      {orders.length ? (
        <div className="orders-history-list">
          {orders.map((order) => (
            <article className="orders-history-row" key={order.id}>
              <div>
                <strong>{order.order_number}</strong>
                <span>{tableLabel(order, t)}</span>
              </div>
              <span>{`${t("order")}: ${orderStatusLabel(order.status, t)}`}</span>
              <span>{`${t("payment")}: ${paymentStatusLabel(order.paymentState, t)}`}</span>
              <span>{order.paymentMethod ? `${t("ordersMethod")}: ${paymentMethodLabel(order.paymentMethod, t)}` : `${t("ordersMethod")}: --`}</span>
              <span>{`ETB ${formatAmount(order.total, locale)}`}</span>
              <time dateTime={order.payment?.created_at || order.created_at}>
                {order.payment?.created_at
                  ? t("ordersPaymentAt").replace("{date}", formatDateTime(order.payment.created_at, locale))
                  : t("ordersOrderAt").replace("{date}", formatDateTime(order.created_at, locale))}
              </time>
            </article>
          ))}
        </div>
      ) : (
        <p className="orders-history-empty">{t("ordersNoHistoryForPeriod")}</p>
      )}
    </section>
  );
}

function CreateOrderForm({ menuItems, tables, t }) {
  const [state, formAction, pending] = useActionState(async (_previousState, formData) => {
    try {
      await createOrder(formData);
      return { success: true, errorKey: "" };
    } catch (error) {
      return { success: false, errorKey: orderErrorKey(error) };
    }
  }, ACTION_INITIAL_STATE);

  return (
    <form className="workspace-panel" action={formAction}>
      <p className="eyebrow">{t("newOrder")}</p>
      <h2>{t("sendToStation")}</h2>
      <label>{t("menuItem")}
        <select name="menu_item_id" required>
          <option value="">{t("selectItem")}</option>
          {(menuItems || []).map((item) => (
            <option value={item.id} key={item.id}>
              {item.name} - {t(item.station === "BAR" ? "bar" : "kitchen")} - ETB {item.price}
            </option>
          ))}
        </select>
      </label>
      <label>{t("quantity")}<input name="quantity" type="number" min="1" defaultValue="1" required /></label>
      <label>{t("table")}
        <select name="table_id">
          <option value="">{t("takeaway")}</option>
          {(tables || []).map((table) => (
            <option value={table.id} key={table.id}>
              {`${t("table")} ${table.table_number}${table.name ? ` - ${table.name}` : ""}`}
            </option>
          ))}
        </select>
      </label>
      <label>{t("notes")}<textarea name="notes" rows="3" /></label>
      {state.errorKey && <p className="orders-action-error" role="alert">{t(state.errorKey)}</p>}
      {state.success && <p className="orders-action-success" role="status">{t("ordersOrderCreated")}</p>}
      <button type="submit" disabled={pending}>{pending ? t("creatingOrder") : t("createOrder")}</button>
    </form>
  );
}

function PaymentForm({ order, paymentOptions, t }) {
  const [state, formAction, pending] = useActionState(async (_previousState, formData) => {
    try {
      await recordPayment(formData);
      return { success: true, errorKey: "" };
    } catch (error) {
      return { success: false, errorKey: paymentErrorKey(error) };
    }
  }, ACTION_INITIAL_STATE);

  return (
    <>
      {order.payment?.status === "COMPLETED" ? (
        <strong>{paymentStatusLabel("COMPLETED", t)}</strong>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="order_id" value={order.id} />
          <input name="amount" type="number" min="0.01" step="0.01" placeholder={t("ordersAmountPlaceholder")} required />
          <select name="method" defaultValue={paymentOptions[0] || "CASH"}>
            {paymentOptions.map((method) => (
              <option value={method} key={method}>{paymentMethodLabel(method, t)}</option>
            ))}
          </select>
          <input name="cash_received" type="number" min="0" step="0.01" placeholder={t("ordersCashReceivedPlaceholder")} />
          <input name="reference_number" placeholder={t("ordersReferenceOptionalPlaceholder")} />
          {state.errorKey && <p className="orders-action-error" role="alert">{t(state.errorKey)}</p>}
          {state.success && <p className="orders-action-success" role="status">{t("paymentRecorded")}</p>}
          <button type="submit" disabled={pending}>{pending ? t("recordingPayment") : t("payRecordPayment")}</button>
        </form>
      )}
    </>
  );
}

export default function OrdersView({
  canMonitorOrders,
  historyRange,
  historicalOrders,
  menuItems,
  orders,
  paymentOptions,
  tables,
}) {
  const { t, language } = useLanguage();
  const locale = DATE_LOCALES[language] || DATE_LOCALES.en;

  return (
    <main className="workspace-page">
      <header className="workspace-header orders-page-header">
        <div>
          <p className="eyebrow">{t("serverWorkspace")}</p>
          <h1>{t("orders")}</h1>
          <p>{t("createOrderDescription")}</p>
        </div>
        <div className="orders-overview-card">
          <Link className="orders-overview-link" href="/">
            <span aria-hidden="true">&larr;</span>{t("overview")}
          </Link>
        </div>
      </header>
      {canMonitorOrders && <OrderMonitor orders={orders} locale={locale} t={t} />}
      {canMonitorOrders && <OrderHistory orders={historicalOrders} range={historyRange} locale={locale} t={t} />}
      <section className="workspace-grid">
        <CreateOrderForm menuItems={menuItems} tables={tables} t={t} />
        <section className="workspace-panel">
          <p className="eyebrow">{t("currentOrders")}</p>
          <h2>{t("recentOrders")}</h2>
          <div className="workspace-list">
            {(orders || []).map((order) => (
              <article className="workspace-row" key={order.id}>
                <strong>{order.order_number}</strong>
                <span>{`${t("order")}: ${orderStatusLabel(order.status, t)}`}</span>
                <span>{`${t("payment")}: ${paymentStatusLabel(order.payment?.status || "UNPAID", t)}`}</span>
                <span>{tableLabel(order, t)}</span>
                <span>{orderTypeLabel(order.orderType, t)}</span>
                <span>{`ETB ${formatAmount(order.total, locale)}`}</span>
                <time dateTime={order.created_at}>{formatTime(order.created_at, locale)}</time>
                <PaymentForm order={order} paymentOptions={paymentOptions} t={t} />
              </article>
            ))}
            {!orders?.length && <p>{t("noOrders")}</p>}
          </div>
        </section>
      </section>
    </main>
  );
}
