"use client";

import { useActionState, useState } from "react";
import { useLanguage } from "./i18n/LanguageProvider";
import { BUSINESS_TIME_ZONE } from "@/lib/business-date.mjs";

const STATUS_FLOW = ["NEW", "PREPARING", "COMPLETED"];

function orderType(order, t) {
  const rawNotes = order.orders?.notes || "";
  const firstSegment = rawNotes.split("|")[0]?.trim();
  const type = String(firstSegment || "").toUpperCase();
  if (type === "DINE_IN") return t("dineIn");
  if (type === "TAKEAWAY") return t("takeaway");
  if (type === "DELIVERY") return t("delivery");
  return firstSegment || t("dineIn");
}

function formatAge(createdAt, t) {
  const ageInMinutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  if (ageInMinutes < 1) return t("justNow");
  if (ageInMinutes < 60) return t("minutesAgo").replace("{count}", String(ageInMinutes));
  const hours = Math.floor(ageInMinutes / 60);
  const minutes = ageInMinutes % 60;
  return t("hoursMinutesAgo").replace("{hours}", String(hours)).replace("{minutes}", String(minutes));
}

function tableLabel(order, t) {
  const table = order.orders?.tables;
  if (!table) return t("takeawayDelivery");
  return table.name || `${t("table")} ${table.table_number}`;
}

function createdTimeLabel(createdAt) {
  return new Date(createdAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
  });
}

function actionLabel(status, t) {
  return status === "NEW" ? t("prepareOrder") : t("completeOrder");
}

function StationOrderCard({ order, updateAction, stationLabel, t }) {
  const [selectedStatus, setSelectedStatus] = useState("");
  const [brokenImages, setBrokenImages] = useState({});
  const [state, formAction, isPending] = useActionState(async (_previousState, formData) => {
    try {
      const result = await updateAction(formData);
      return { success: t("stationOrderMovedTo").replace("{status}", t(result.status)), error: "" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const errorKey = message.includes("access denied")
        ? "stationAccessDenied"
        : message.startsWith("Invalid ") && message.endsWith(" status.")
          ? "stationInvalidStatus"
          : message.includes("order not found")
            ? "stationOrderNotFound"
            : message === "You do not have permission to complete this station order."
              ? "stationCompletionPermissionDenied"
              : message === "Only orders being prepared can be completed."
                ? "stationCompletionRequiresPreparation"
                : message === "Insufficient inventory for this order."
                  ? "stationInsufficientInventory"
            : null;
      const transition = message.match(/order cannot move from (.+) to (.+)\./i);
      const errorMessage = transition
        ? t("stationOrderTransitionInvalid").replace("{current}", t(transition[1])).replace("{next}", t(transition[2]))
        : errorKey
          ? t(errorKey)
          : t("stationOrderUpdateFailed");
      return { success: "", error: errorMessage };
    }
  }, { success: "", error: "" });

  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1];
  const items = order.orders?.order_items || [];
  const statusClass = `status-${String(order.status).toLowerCase()}`;

  return (
    <article className={`kds-card ${statusClass}`}>
      <div className="kds-card-header">
        <div className="kds-order-main">
          <span className="kds-order-id">#{order.orders?.order_number || order.id.slice(0, 6)}</span>
        </div>
        <div className="kds-card-meta">
          <span className={`kds-status-badge ${statusClass}`}>{t(order.status)}</span>
          <small>{formatAge(order.created_at, t)}</small>
        </div>
      </div>

      <div className="kds-order-context">
        <strong className="kds-table-label">{tableLabel(order, t)}</strong>
        <time className="kds-time-label" dateTime={order.created_at}>{createdTimeLabel(order.created_at)}</time>
        <span className="kds-station-badge">{stationLabel}</span>
      </div>

      <div className="kds-order-type-row">
        <span>{t("orderType")}</span>
        <strong>{orderType(order, t)}</strong>
      </div>

      <div className="kds-items">
        {items.map((item, index) => (
          <div className="kds-item" key={`${item.menu_item_id || item.menu_items?.name}-${index}`}>
            {item.menu_items?.image_url && !brokenImages[item.menu_item_id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="kds-item-image"
                src={item.menu_items.image_url}
                alt=""
                onError={() => setBrokenImages((images) => ({ ...images, [item.menu_item_id]: true }))}
              />
            ) : <span className="kds-item-image-fallback">{t("imageUnavailable")}</span>}
            <div className="kds-item-body">
              <div className="kds-item-row">
                <span className="kds-qty-badge">{item.quantity}x</span>
                <strong>{item.menu_items?.name || t("menuItem")}</strong>
              </div>
              {item.notes ? <small>{orderType({ orders: { notes: item.notes } }, t)}</small> : <small>—</small>}
            </div>
          </div>
        ))}
      </div>

      {order.orders?.notes && (
        <div className="kds-order-notes">
          <span>{t("notes")}</span>
          <p>{order.orders.notes}</p>
        </div>
      )}

      <form action={formAction}>
        <input type="hidden" name="id" value={order.id} />
        <input type="hidden" name="status" value={nextStatus || ""} />
        <div className="kds-actions">
          {nextStatus ? (
            <button
              type="submit"
              disabled={isPending}
              onClick={() => setSelectedStatus(nextStatus)}
            >
              {isPending && selectedStatus === nextStatus ? t("updating") : actionLabel(order.status, t)}
            </button>
          ) : <span className="kds-complete-label">{t("COMPLETED")}</span>}
        </div>
        {state.success && <p className="kds-success" role="status">{state.success}</p>}
        {state.error && <p className="kds-error" role="alert">{state.error}</p>}
      </form>
    </article>
  );
}

export default function StationOrderBoard({ orders, updateAction, station }) {
  const { t } = useLanguage();
  const stationLabel = station === "KITCHEN" ? t("historyKitchenLabel") : t("historyBarLabel");
  return (
    <section className="kds-grid" aria-live="polite">
      {orders.map((order) => (
        <StationOrderCard
          key={order.id}
          order={order}
          updateAction={updateAction}
          stationLabel={stationLabel}
          t={t}
        />
      ))}
      {!orders.length && <p>{t("noStationOrders").replace("{station}", stationLabel.toLowerCase())}</p>}
    </section>
  );
}
