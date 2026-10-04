"use client";

import Link from "next/link";
import { useLanguage } from "@/app/i18n/LanguageProvider";
import { BUSINESS_TIME_ZONE } from "@/lib/business-date.mjs";

const RECORD_TYPE_KEYS = {
  ORDER: "order",
  PAYMENT: "payment",
  STOCK_MOVEMENT: "historyStockMovement",
  STOCK_REQUEST: "historyStockRequest",
  STATION: "historyTypeStation",
};

const STATUS_KEYS = {
  NEW: "NEW",
  CONFIRMED: "historyStatusConfirmed",
  PREPARING: "PREPARING",
  READY: "READY",
  SERVED: "historyStatusServed",
  COMPLETED: "COMPLETED",
  CANCELLED: "historyStatusCancelled",
  PAID: "historyStatusPaid",
  PENDING: "historyStatusPending",
  FAILED: "historyStatusFailed",
  REFUNDED: "historyStatusRefunded",
  APPROVED: "historyStatusApproved",
  REJECTED: "historyStatusRejected",
  FULFILLED: "historyStatusFulfilled",
  ADD_STOCK: "historyMovementAddStock",
  USAGE: "historyMovementUsage",
  ADJUSTMENT: "historyMovementAdjustment",
  TRANSFER: "historyMovementTransfer",
  RETURN: "historyMovementReturn",
  WASTE: "historyMovementWaste",
};

const MOVEMENT_KEYS = {
  ADD_STOCK: "historyMovementAddStock",
  USAGE: "historyMovementUsage",
  ADJUSTMENT: "historyMovementAdjustment",
  TRANSFER: "historyMovementTransfer",
  RETURN: "historyMovementReturn",
  WASTE: "historyMovementWaste",
  REJECTED: "historyStatusRejected",
};

const PERIOD_LABEL_KEYS = {
  LAST_7_DAYS: "historyLast7Days",
  YEAR_1: "historyYearOne",
};

const DATE_LOCALES = { en: "en-US", am: "am-ET", om: "om-ET", ti: "ti-ET" };

function formatDate(value, locale, includeTime = true) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return includeTime
    ? date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short", timeZone: BUSINESS_TIME_ZONE })
    : date.toLocaleDateString(locale, { dateStyle: "medium", timeZone: BUSINESS_TIME_ZONE });
}

function interpolate(value, params) {
  return Object.entries(params).reduce(
    (result, [key, replacement]) => result.replaceAll(`{${key}}`, replacement),
    value,
  );
}

function recordTypeLabel(type, t) {
  const key = RECORD_TYPE_KEYS[type];
  return key ? t(key) : type.replaceAll("_", " ");
}

function recordStatusLabel(status, t) {
  const key = STATUS_KEYS[status];
  return key ? t(key) : status || t("historyStatusRecorded");
}

function stationLabel(station, t) {
  if (station === "KITCHEN") return t("historyKitchenLabel");
  if (station === "BAR") return t("historyBarLabel");
  return station || t("station");
}

function orderTypeLabel(orderType, t) {
  if (orderType === "TAKEAWAY") return t("takeaway");
  if (orderType === "DELIVERY") return t("delivery");
  if (orderType === "DINE_IN") return t("dineIn");
  return orderType;
}

function paymentMethodLabel(method, t) {
  if (method === "CASH") return t("cash");
  if (method === "TELEBIRR") return t("telebirr");
  if (method === "BANK_TRANSFER") return `${t("cbe")} / ${t("historyBankTransferMethod")}`;
  return method;
}

function recordSubtitle(record, t) {
  const display = record.display || {};
  if (display.kind === "order") {
    const location = display.locationName || (display.tableNumber ? `${t("table")} ${display.tableNumber}` : t("takeaway"));
    return `${location} · ${orderTypeLabel(display.orderType, t)}`;
  }
  if (display.kind === "payment") return paymentMethodLabel(display.method, t);
  if (display.kind === "movement") return t(MOVEMENT_KEYS[display.movementType]) || display.movementType;
  if (display.kind === "request") {
    return `${stationLabel(display.station, t)} · ${display.quantity} ${display.unit} · ${t("requestedBy")} ${display.requestedBy || t("historyStaffMember")}`;
  }
  if (display.kind === "station") return `${stationLabel(display.station, t)} ${t("historyWorkflow")}`;
  return record.subtitle;
}

function recordDetails(record, t, locale) {
  const display = record.display || {};
  if (display.kind === "movement") {
    const amount = `${display.delta > 0 ? "+" : ""}${display.delta} ${display.unit}`;
    return `${amount} · ${display.reason || t("historyNoReason")}`;
  }
  if (display.kind === "request") {
    const details = `${display.note || t("historyNoNote")} · ${t("historyCreatedLabel")} ${formatDate(display.createdAt, locale)}`;
    return display.updatedAt ? `${details} · ${t("historyUpdatedLabel")} ${formatDate(display.updatedAt, locale)}` : details;
  }
  if (display.kind === "station") return t("historyOperationalRecord");
  return record.details;
}

function recordTitle(record, t) {
  return record.display?.fallbackTitle ? t("historyInventoryItem") : record.title;
}

function periodLabel(period, periodNumber, t) {
  if (PERIOD_LABEL_KEYS[period]) return t(PERIOD_LABEL_KEYS[period]);
  const key = period.startsWith("WEEK_") ? "historyWeek" : "historyMonth";
  return interpolate(t(key), { number: periodNumber });
}

function periodHref(value, { year, search, type, status, station }) {
  const params = new URLSearchParams();
  params.set("period", value);
  params.set("year", String(year));
  if (search) params.set("q", search);
  if (type !== "ALL") params.set("type", type);
  if (status) params.set("status", status);
  if (station) params.set("station", station);
  return `/history?${params.toString()}`;
}

function periodOptionLabel(option, t) {
  if (PERIOD_LABEL_KEYS[option.value]) return t(PERIOD_LABEL_KEYS[option.value]);
  return interpolate(t(option.labelKey), { number: option.number });
}

export default function HistoryView({
  availableYears,
  bestSellingItems,
  filters,
  hasRecords,
  period,
  periodDefinition,
  periods,
  records,
  summary,
  year,
}) {
  const { t, language } = useLanguage();
  const locale = DATE_LOCALES[language] || DATE_LOCALES.en;

  return (
    <main className="history-page">
      <div className="history-shell">
        <header className="history-header">
          <div>
            <p className="eyebrow">{t("operations")}</p>
            <h1>{t("history")}</h1>
            <p>{t("historyRestaurantActivity")}</p>
          </div>
          <Link className="history-back" href="/">{t("overview")}</Link>
        </header>

        <section className="history-summary" aria-label={t("historySummary")}>
          {[
            ["historyTotalRecords", summary.total],
            ["historyTotalOrders", summary.orders],
            ["completedOrders", summary.completedOrders],
            ["historyStockRequests", summary.requests],
            ["historyStockMovements", summary.movements],
            ...(filters.canViewFinancials
              ? [["historyPayments", summary.payments], ["historyRevenue", summary.revenue]]
              : []),
            ["historyKitchenActivity", summary.kitchen],
            ["historyBarActivity", summary.bar],
          ].map(([labelKey, value]) => (
            <article className="history-summary-card" key={labelKey}>
              <span>{t(labelKey)}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </section>

        <section className="history-panel history-filters">
          <div className="history-period-toolbar">
            <div className="history-period-group">
              {periods.map((option) => (
                <Link
                  className={`history-period-button${period === option.value ? " active" : ""}`}
                  href={periodHref(option.value, { year, ...filters })}
                  key={option.value}
                >
                  {periodOptionLabel(option, t)}
                </Link>
              ))}
            </div>
            <form method="get" className="history-year-form">
              <input type="hidden" name="period" value={period} />
              <label className="history-year-selector">
                {t("historyYear")}
                <select name="year" defaultValue={String(year)}>
                  {availableYears.map((availableYear) => (
                    <option key={availableYear} value={availableYear}>{availableYear}</option>
                  ))}
                </select>
              </label>
              <button type="submit">{t("historyApplyYear")}</button>
            </form>
          </div>

          <div className="history-period-range">
            <strong>{periodLabel(period, periodDefinition.number, t)}</strong>
            <span>{formatDate(filters.displayFrom, locale, false)} → {formatDate(filters.displayTo, locale, false)}</span>
          </div>

          <form id="history-filter-form" method="get">
            <input type="hidden" name="period" value={period} />
            <input type="hidden" name="year" value={year} />
            <label>{t("search")}<input name="q" defaultValue={filters.search} placeholder={t("historySearchPlaceholder")} /></label>
            <label>{t("historyFrom")}<input name="from" type="date" defaultValue={filters.from || ""} /></label>
            <label>{t("historyTo")}<input name="to" type="date" defaultValue={filters.to} /></label>
            <label>
              {t("historyRecordType")}
              <select name="type" defaultValue={filters.type}>
                <option value="ALL">{t("historyAllRecords")}</option>
                {Object.entries(RECORD_TYPE_KEYS).map(([value, key]) => (
                  <option key={value} value={value}>{t(key)}</option>
                ))}
              </select>
            </label>
            <label>{t("status")}<input name="status" defaultValue={filters.status} placeholder={t("historyStatusPlaceholder")} /></label>
            <label>
              {t("station")}
              <select name="station" defaultValue={filters.station}>
                <option value="">{t("historyAllStations")}</option>
                <option value="KITCHEN">{t("historyKitchenLabel")}</option>
                <option value="BAR">{t("historyBarLabel")}</option>
              </select>
            </label>
            <button type="submit">{t("historyApplyFilters")}</button>
            <Link className="history-clear" href="/history">{t("historyClear")}</Link>
          </form>
        </section>

        {filters.canViewFinancials && (
          <section className="history-panel history-best-selling">
            <div className="history-section-heading">
              <h2>{t("bestSellingItems")}</h2>
              {bestSellingItems.length > 0 && (
                <div className="history-best-selling-columns">
                  <span>{t("historyQuantitySold")}</span>
                  <span>{t("historyTotalSales")}</span>
                </div>
              )}
            </div>
            {bestSellingItems.length ? (
              <div className="history-best-selling-list">
                {bestSellingItems.map((item) => (
                  <article className="history-best-selling-row" key={item.id}>
                    <div className="history-best-selling-item">
                      <strong>{item.name}</strong>
                      {item.station && <span className="history-station">{stationLabel(item.station, t)}</span>}
                    </div>
                    <div className="history-best-selling-quantity">
                      <strong>{item.quantitySold}</strong>
                      <div className="history-best-selling-track" aria-hidden="true">
                        <span style={{ width: `${Math.max(4, (item.quantitySold / bestSellingItems[0].quantitySold) * 100)}%` }} />
                      </div>
                    </div>
                    <strong className="history-best-selling-sales">{item.totalSales}</strong>
                  </article>
                ))}
              </div>
            ) : <p className="history-best-selling-empty">{t("historyNoSalesData")}</p>}
          </section>
        )}

        <section className="history-panel">
          <div className="history-section-heading">
            <div><p className="eyebrow">{t("historyAuditTrail")}</p><h2>{t("historyRecentActivity")}</h2></div>
            <span>{interpolate(t("historyRecordsPerSource"), { limit: 50 })}</span>
          </div>
          {records.length ? (
            <div className="history-list">
              {records.map((record, index) => (
                <article className="history-row" key={`${record.type}-${record.createdAt}-${record.title}-${index}`}>
                  <div className="history-row-main">
                    <span className="history-type">{recordTypeLabel(record.type, t)}</span>
                    <strong>{recordTitle(record, t)}</strong>
                    <span className="history-subtitle">{recordSubtitle(record, t)}</span>
                    <small>{recordDetails(record, t, locale)}</small>
                  </div>
                  <div className="history-row-meta">
                    {record.station && <span className="history-station">{stationLabel(record.station, t)}</span>}
                    <span className={record.statusClass}>{recordStatusLabel(record.status, t)}</span>
                    <time dateTime={record.createdAt}>{formatDate(record.createdAt, locale)}</time>
                    {record.href && <Link href={record.href}>{t("historyOpen")}</Link>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="history-empty">
              <strong>{hasRecords ? t("historyNoRecordsMatch") : t("historyNoHistoryYet")}</strong>
              <span>{hasRecords ? t("historyTryClearingFilters") : t("historyActivityAppears")}</span>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}