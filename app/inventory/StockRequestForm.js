"use client";

import { useActionState, useState } from "react";
import { createStockRequest } from "./actions";
import { useLanguage } from "../i18n/LanguageProvider";

const initialState = { success: "", error: "" };
const unitOptions = ["kg", "g", "L", "ml", "pcs", "box"];

export default function StockRequestForm({ station }) {
  const { t } = useLanguage();
  const [unit, setUnit] = useState("pcs");
  const [state, formAction, pending] = useActionState(async (_previousState, formData) => {
    try {
      await createStockRequest(formData);
      return { success: true, error: "" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "",
      };
    }
  }, initialState);
  const stationName = station === "KITCHEN" ? t("historyKitchenLabel") : t("historyBarLabel");
  const errorKeys = {
    "You do not have permission to create stock requests.": "stockRequestPermissionDenied",
    "Item name is required.": "stockRequestNameRequired",
    "A valid station is required.": "stockRequestStationRequired",
    "Quantity must be a valid number.": "stockRequestQuantityInvalid",
    "Requested quantity must be greater than zero.": "stockRequestQuantityPositive",
    "Choose a supported request unit.": "stockRequestUnitUnsupported",
    "You can only request stock for your assigned station.": "stockRequestAssignedStationOnly",
    "You already have a pending request for this item.": "stockRequestPendingDuplicate",
  };
  function localizedError(message) {
    return t(errorKeys[message] || "stockRequestGenericError");
  }

  function setLocalizedRequired(event) {
    event.currentTarget.setCustomValidity(t("stockRequestRequired"));
  }

  function clearRequired(event) {
    event.currentTarget.setCustomValidity("");
  }

  return (
    <section className="stock-request-panel" aria-labelledby={`${station.toLowerCase()}-stock-request-title`}>
      <div className="stock-request-heading">
        <div>
          <p className="stock-request-eyebrow">{stationName} / {t("workspaceInventoryLabel")}</p>
          <h2 id={`${station.toLowerCase()}-stock-request-title`}>{t("stockRequestAddTitle")}</h2>
          <p>{t("stockRequestDescription")}</p>
        </div>
        <span className="stock-request-station">{stationName}</span>
      </div>
      <form action={formAction}>
        <input type="hidden" name="station" value={station} />
        <div className="stock-request-field">
          <label htmlFor={`${station.toLowerCase()}-stock-item`}>{t("stockRequestItemName")}</label>
          <input id={`${station.toLowerCase()}-stock-item`} name="requested_item_name" placeholder={t("stockRequestItemNamePlaceholder")} required onInvalid={setLocalizedRequired} onInput={clearRequired} disabled={pending} />
        </div>
        <div className="stock-request-details">
          <div className="stock-request-field">
            <label htmlFor={`${station.toLowerCase()}-stock-type`}>{t("stockRequestItemType")}</label>
            <input id={`${station.toLowerCase()}-stock-type`} value={stationName} readOnly aria-label={t("station")} />
          </div>
          <div className="stock-request-field">
            <label htmlFor={`${station.toLowerCase()}-stock-unit`}>{t("stockRequestUnit")}</label>
            <select id={`${station.toLowerCase()}-stock-unit`} name="unit" value={unit} onChange={(event) => setUnit(event.target.value)} required disabled={pending}>
              {unitOptions.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </select>
          </div>
        </div>
        <div className="stock-request-field">
            <label htmlFor={`${station.toLowerCase()}-stock-quantity`}>{t("quantity")}</label>
            <div className="stock-request-quantity-wrap">
              <input id={`${station.toLowerCase()}-stock-quantity`} name="quantity" type="number" min="0.001" step="0.001" required onInvalid={setLocalizedRequired} onInput={clearRequired} disabled={pending} />
              <span>{unit}</span>
            </div>
        </div>
        <div className="stock-request-field">
          <label htmlFor={`${station.toLowerCase()}-stock-note`}>{t("stockRequestReasonNote")} <span>{t("stockRequestOptional")}</span></label>
          <textarea id={`${station.toLowerCase()}-stock-note`} name="note" placeholder={t("stockRequestNotePlaceholder")} disabled={pending} />
        </div>
        <button className="stock-request-submit" type="submit" disabled={pending}>
          {pending ? t("stockRequestSubmitting") : t("stockRequestSubmit")}
        </button>
        {state.success && <div className="stock-request-success" role="status"><strong>{t("stockRequestSuccessTitle")}</strong><span>{t("status")}: {t("PENDING")}</span></div>}
        {state.error && <p className="stock-request-error" role="alert">{localizedError(state.error)}</p>}
      </form>
    </section>
  );
}