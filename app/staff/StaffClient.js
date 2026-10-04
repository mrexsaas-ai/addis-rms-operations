"use client";

import { useState, useTransition } from "react";
import { addShift, createStaff } from "./actions";
import { useLanguage } from "../i18n/LanguageProvider";

const roles = [
  { value: "SERVER", key: "roleSERVER" },
  { value: "CHEF", key: "roleCHEF" },
  { value: "BARMAN", key: "roleBARMAN" },
  { value: "MANAGER", key: "roleMANAGER" },
];

function translateStaffMessage(message, t) {
  const keys = {
    "Could not create staff member.": "couldNotCreateStaff",
    "Could not add shift.": "couldNotAddShift",
    "Shift date, start time and end time are required.": "shiftFieldsRequired",
    "Shift end time must be later than start time.": "shiftEndMustBeLater",
    "Staff member created successfully.": "staffCreated",
    "Shift added successfully.": "shiftAdded",
  };
  return keys[message] ? t(keys[message]) : t(message) === message ? message : t(message);
}

export default function StaffClient({ staff = [] }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [shiftMessage, setShiftMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [staffStartTime, setStaffStartTime] = useState("");
  const [staffEndTime, setStaffEndTime] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    formData.delete("start_time");
    formData.delete("end_time");

    setMessage("");

    startTransition(async () => {
      try {
        const result = await createStaff(formData);

        form.reset();
        setStaffStartTime("");
        setStaffEndTime("");
        setOpen(false);
        setMessage(translateStaffMessage(result.message, t));

        window.location.reload();
      } catch (error) {
        setMessage(
          translateStaffMessage(error?.message || "Could not create staff member.", t)
        );
      }
    });
  }

  function handleShiftSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    setShiftMessage("");

    startTransition(async () => {
      try {
        const result = await addShift(formData);

        form.reset();
        setShiftOpen(false);
        setShiftMessage(translateStaffMessage(result.message, t));

        window.location.reload();
      } catch (error) {
        setShiftMessage(
          translateStaffMessage(error?.message || "Could not add shift.", t)
        );
      }
    });
  }

  return (
    <>
      <div className="staff-action-row">
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setMessage("");
            setStaffStartTime("");
            setStaffEndTime("");
            setOpen(true);
          }}
        >
          + {t("addStaff")}
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setShiftMessage("");
            setShiftOpen(true);
          }}
        >
          + {t("addShift")}
        </button>
      </div>

      {message && !open && (
        <div className="staff-message">
          {message}
        </div>
      )}

      {shiftMessage && !shiftOpen && (
        <div className="staff-message">
          {shiftMessage}
        </div>
      )}

      {open && (
        <div
          className="staff-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !isPending
            ) {
              setOpen(false);
            }
          }}
        >
          <div className="staff-modal staff-create-modal">
            <div className="staff-modal-header">
              <div>
                <p className="eyebrow">
                  {t("staffManagement")}
                </p>

                <h2>{t("addStaffMember")}</h2>
              </div>

              <button
                type="button"
                className="staff-modal-close"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                ×
              </button>
            </div>

            <form
              className="staff-form staff-create-form"
              onSubmit={handleSubmit}
            >
              <div className="staff-form-grid">
                <label>
                  <span>{t("fullName")}</span>

                  <input
                    name="full_name"
                    type="text"
                    placeholder={t("enterFullName")}
                    required
                  />
                </label>

                <label>
                  <span>{t("email")}</span>

                  <input
                    name="email"
                    type="email"
                    placeholder={t("staffEmailPlaceholder")}
                    required
                  />
                </label>

                <label>
                  <span>{t("password")}</span>

                  <span className="password-field">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t("minimumPassword")}
                      minLength={6}
                      required
                    />

                    <button
                      type="button"
                      className="password-toggle"
                      aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? t("hide") : t("show")}
                    </button>
                  </span>
                </label>

                <label>
                  <span>{t("role")}</span>

                  <select
                    name="role"
                    defaultValue="SERVER"
                    required
                  >
                    {roles.map((role) => (
                      <option
                        key={role.value}
                        value={role.value}
                      >
                        {t(role.key)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="staff-create-time-grid">
                  <label>
                    <span>{t("startTime")}</span>

                    <input
                      name="start_time"
                      type="time"
                      value={staffStartTime}
                      onChange={(event) => setStaffStartTime(event.target.value)}
                    />
                  </label>

                  <label>
                    <span>{t("endTime")}</span>

                    <input
                      name="end_time"
                      type="time"
                      value={staffEndTime}
                      onChange={(event) => setStaffEndTime(event.target.value)}
                    />
                  </label>
                </div>
              </div>

              {message && (
                <div className="staff-form-error">
                  {message}
                </div>
              )}

              <div className="staff-form-actions staff-create-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                >
                  {t("cancel")}
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={isPending}
                >
                  {isPending
                    ? t("creating")
                    : t("createStaff")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {shiftOpen && (
        <div
          className="staff-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !isPending
            ) {
              setShiftOpen(false);
            }
          }}
        >
          <div className="staff-modal">
            <div className="staff-modal-header">
              <div>
                <p className="eyebrow">
                  {t("staffManagement")}
                </p>

                <h2>{t("addShift")}</h2>
              </div>

              <button
                type="button"
                className="staff-modal-close"
                onClick={() => setShiftOpen(false)}
                disabled={isPending}
              >
                ×
              </button>
            </div>

            <form
              className="staff-form"
              onSubmit={handleShiftSubmit}
            >
              <div className="staff-form-grid shift-form-grid">
                <label>
                  <span>{t("staff")}</span>

                  <select
                    name="staff_user_id"
                    defaultValue=""
                    required
                  >
                    <option value="">{t("selectStaffMember")}</option>

                    {staff.map((member) => (
                      <option
                        key={member.userId}
                        value={member.userId}
                      >
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>{t("shiftName")}</span>

                  <input
                    name="shift_name"
                    type="text"
                    placeholder={t("morningRush")}
                  />
                </label>

                <label>
                  <span>{t("shiftDate")}</span>

                  <input
                    name="shift_date"
                    type="date"
                    required
                  />
                </label>

                <label className="shift-time-field">
                  <span>{t("startTime")}</span>

                  <input
                    name="start_time"
                    type="time"
                    required
                  />
                </label>

                <label className="shift-time-field">
                  <span>{t("endTime")}</span>

                  <input
                    name="end_time"
                    type="time"
                    required
                  />
                </label>
              </div>

              {shiftMessage && (
                <div className="staff-form-error">
                  {shiftMessage}
                </div>
              )}

              <div className="staff-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShiftOpen(false)}
                  disabled={isPending}
                >
                  {t("cancel")}
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={isPending}
                >
                  {isPending ? t("adding") : t("addShift")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}