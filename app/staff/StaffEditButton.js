"use client";

import { useState, useTransition } from "react";
import { deleteStaff, updateStaff } from "./actions";
import { useLanguage } from "../i18n/LanguageProvider";

function translateEditMessage(message, t) {
  const keys = {
    "Could not remove staff access.": "couldNotRemoveStaff",
    "Staff member removed.": "staffAccessRemoved",
    "Staff user ID is required.": "staffUserIdRequired",
    "You cannot remove your own account.": "cannotRemoveOwnAccount",
    "Staff member was not found.": "staffMemberNotFound",
    "You do not have permission to manage staff.": "staffAdminOnly",
  };
  const key = keys[message] || message;
  return t(key) === key ? key : t(key);
}

const roles = [
  { value: "SERVER", key: "roleSERVER" },
  { value: "CHEF", key: "roleCHEF" },
  { value: "BARMAN", key: "roleBARMAN" },
  { value: "MANAGER", key: "roleMANAGER" },
];

export default function StaffEditButton({ staff, canRemoveStaff = false }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage("");

    startTransition(async () => {
      try {
        const result = await updateStaff(new FormData(form));
        setMessage(translateEditMessage(result.message, t));
        setOpen(false);
        window.location.reload();
      } catch (error) {
        setMessage(translateEditMessage(error?.message || t("couldNotUpdateStaff"), t));
      }
    });
  }

  function handleRemove() {
    setMessage("");

    startTransition(async () => {
      try {
        await deleteStaff(staff.userId);
        setRemoveOpen(false);
        window.location.reload();
      } catch (error) {
        setMessage(translateEditMessage(error?.message || "Could not remove staff access.", t));
      }
    });
  }

  return (
    <>
      <button type="button" className="small-button" onClick={() => { setMessage(""); setOpen(true); }}>
        {t("edit")}
      </button>
      {canRemoveStaff && !staff.isCurrentUser && (
        <button
          type="button"
          className="small-button"
          onClick={() => { setMessage(""); setRemoveOpen(true); }}
        >
          {t("removeStaffAccess")}
        </button>
      )}
      {message && <span className="staff-message">{message}</span>}
      {removeOpen && (
        <div
          className="staff-modal-overlay"
          onMouseDown={(event) => event.target === event.currentTarget && !isPending && setRemoveOpen(false)}
        >
          <div
            className="staff-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`remove-staff-title-${staff.userId}`}
          >
            <div className="staff-modal-header">
              <div>
                <p className="eyebrow">{t("staffManagement")}</p>
                <h2 id={`remove-staff-title-${staff.userId}`}>{t("confirmRemoveStaffAccess")}</h2>
              </div>
              <button type="button" className="staff-modal-close" onClick={() => setRemoveOpen(false)} disabled={isPending}>×</button>
            </div>
            <div className="staff-form">
              <p><strong>{staff.name}</strong> · {t(`role${staff.role}`)}</p>
              <p>{t("removeStaffAccessWarning")}</p>
              {message && <div className="staff-form-error" role="alert">{message}</div>}
              <div className="staff-form-actions">
                <button type="button" className="secondary-button" onClick={() => setRemoveOpen(false)} disabled={isPending}>{t("cancel")}</button>
                <button type="button" className="primary-button" onClick={handleRemove} disabled={isPending}>
                  {isPending ? t("removingStaffAccess") : t("removeStaffAccess")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {open && (
        <div className="staff-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && !isPending && setOpen(false)}>
          <div className="staff-modal">
            <div className="staff-modal-header">
              <div><p className="eyebrow">{t("staffManagement")}</p><h2>{t("editStaff")} {staff.name}</h2></div>
              <button type="button" className="staff-modal-close" onClick={() => setOpen(false)} disabled={isPending}>×</button>
            </div>
            <form className="staff-form" onSubmit={handleSubmit}>
              <input type="hidden" name="user_id" value={staff.userId} />
              <input type="hidden" name="shift_id" value={staff.shift?.id || ""} />
              <label><span>{t("fullName")}</span><input name="full_name" defaultValue={staff.name} required /></label>
              <label><span>{t("role")}</span><select name="role" defaultValue={staff.role} required>{roles.map((role) => <option key={role.value} value={role.value}>{t(role.key)}</option>)}</select></label>
              <label><span>{t("newPassword")}</span><input name="password" type="password" autoComplete="new-password" minLength={6} placeholder={t("leaveBlankPassword")} /></label>
              <div className="shift-form-grid">
                <label><span>{t("shiftDate")}</span><input name="shift_date" type="date" defaultValue={staff.shift?.shift_date || ""} /></label>
                <label><span>{t("startTime")}</span><input name="start_time" type="time" defaultValue={staff.shift?.start_time?.slice(0, 5) || ""} /></label>
                <label><span>{t("endTime")}</span><input name="end_time" type="time" defaultValue={staff.shift?.end_time?.slice(0, 5) || ""} /></label>
              </div>
              {message && <div className="staff-form-error" role="alert">{message}</div>}
              <div className="staff-form-actions">
                <button type="button" className="secondary-button" onClick={() => setOpen(false)} disabled={isPending}>{t("cancel")}</button>
                <button type="submit" className="primary-button" disabled={isPending}>{isPending ? t("saving") : t("saveChanges")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
