"use client";

import { updateStockRequestStatus } from "./actions";
import { useLanguage } from "../i18n/LanguageProvider";
import { BUSINESS_TIME_ZONE } from "@/lib/business-date.mjs";

function formatQuantity(value) {
  return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatRequestDate(value) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BUSINESS_TIME_ZONE,
  });
}

export default function InventoryRequests({ requests = [], profileNames = {} }) {
  const { t } = useLanguage();

  return (
    <section className="inventory-requests" aria-labelledby="inventory-requests-title">
      <div className="inventory-requests-heading">
        <div>
          <p className="eyebrow">{t("inventoryApproval")}</p>
          <h2 id="inventory-requests-title">{t("inventoryRequests")}</h2>
        </div>
        <span className="inventory-request-count">{requests.length}</span>
      </div>

      {requests.length ? (
        <div className="inventory-request-list">
          {requests.map((request) => (
            <article className="inventory-request-card" key={request.id}>
              <div className="inventory-request-details">
                <div className="inventory-request-item">
                  <span>{t("item")}</span>
                  <strong>{request.inventory_items?.name || request.requested_item_name}</strong>
                </div>
                <div>
                  <span>{t("quantity")}</span>
                  <strong>{formatQuantity(request.quantity)} {request.unit}</strong>
                </div>
                <div>
                  <span>{t("requestedBy")}</span>
                  <strong>{profileNames[request.requested_by_user_id] || t("staff")}</strong>
                </div>
                <div>
                  <span>{t("station")}</span>
                  <strong>{request.station}</strong>
                </div>
                <div>
                  <span>{t("requestDate")}</span>
                  <strong>{formatRequestDate(request.created_at)}</strong>
                </div>
                {request.note && (
                  <div className="inventory-request-note">
                    <span>{t("reason")}</span>
                    <strong>{request.note}</strong>
                  </div>
                )}
              </div>

              <div className="inventory-request-actions">
                <form action={updateStockRequestStatus}>
                  <input type="hidden" name="request_id" value={request.id} />
                  <input type="hidden" name="status" value="APPROVED" />
                  <button className="inventory-approve-button" type="submit">{t("approve")}</button>
                </form>
                <form action={updateStockRequestStatus}>
                  <input type="hidden" name="request_id" value={request.id} />
                  <input type="hidden" name="status" value="REJECTED" />
                  <button className="inventory-reject-button" type="submit">{t("reject")}</button>
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="inventory-empty-state">{t("noPendingInventoryRequests")}</p>
      )}
    </section>
  );
}
