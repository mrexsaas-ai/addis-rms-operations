"use client";

import { useLanguage } from "../i18n/LanguageProvider";
import { deleteTable, updateTable, updateTableStatus } from "./actions";

const statusClass = {
  AVAILABLE: "available",
  OCCUPIED: "occupied",
  RESERVED: "reserved",
  CLEANING: "cleaning",
};

const statusKeys = {
  AVAILABLE: "availableStatus",
  OCCUPIED: "occupiedStatus",
  RESERVED: "reservedStatus",
  CLEANING: "cleaningStatus",
};

export default function TableCard({ table, canManage, canUpdate, role }) {
  const { t } = useLanguage();
  const canChangeStatus = canUpdate && (canManage || (role === "SERVER" && table.status === "OCCUPIED"));
  const statusOptions = role === "SERVER"
    ? ["AVAILABLE"]
    : ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"];

  return (
    <article className="table-card" data-table-status={table.status}>
      <div className="table-head">
        <div>
          <div className="table-number">T{table.table_number}</div>
          <div className="table-name">{table.name || t("diningTable")}</div>
        </div>
        <span className={`badge ${statusClass[table.status] || ""}`}>
          {t(statusKeys[table.status] || table.status)}
        </span>
      </div>

      <div className="capacity">
        <span>{t("seats")}</span> {table.capacity} <span>{t("guests")}</span>
      </div>

      {canChangeStatus && (
        <form action={updateTableStatus} className="status-controls">
          <input type="hidden" name="id" value={table.id} />
          <label className="sr-only" htmlFor={`status-${table.id}`}>{t("changeStatus")}</label>
          <select id={`status-${table.id}`} name="status" defaultValue="">
            <option value="">{t("changeStatus")}</option>
            {statusOptions.filter((status) => status !== table.status).map((status) => (
              <option value={status} key={status}>{t(statusKeys[status])}</option>
            ))}
          </select>
          <button className="small-btn" type="submit">{t("save")}</button>
        </form>
      )}

      {canManage && (
        <details>
          <summary>{t("editTable")}</summary>
          <form action={updateTable} className="edit-table-form">
            <input type="hidden" name="id" value={table.id} />
            <div className="field">
              <label>{t("tableNumber")}</label>
              <input name="table_number" type="number" min="1" defaultValue={table.table_number} required />
            </div>
            <div className="field">
              <label>{t("displayName")}</label>
              <input name="name" defaultValue={table.name || ""} />
            </div>
            <div className="field">
              <label>{t("capacity")}</label>
              <input name="capacity" type="number" min="1" defaultValue={table.capacity} required />
            </div>
            <button className="small-btn" type="submit">{t("saveDetails")}</button>
          </form>
        </details>
      )}

      {canManage && (
        <form action={deleteTable}>
          <input type="hidden" name="id" value={table.id} />
          <button className="small-btn delete-btn" type="submit">{t("deleteTable")}</button>
        </form>
      )}
    </article>
  );
}
