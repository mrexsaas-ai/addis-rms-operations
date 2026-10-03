"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clockIn, clockOut } from "./actions";
import { useLanguage } from "../i18n/LanguageProvider";

const clockInMessages = {
  "You are already clocked in for this shift.": "clockInAlreadyError",
  "This shift has already been completed.": "clockInCompletedError",
  "Scheduled shift was not found for this staff member.": "clockInShiftNotFoundError",
  "Active staff membership was not found for this restaurant.": "attendanceMembershipError",
  "Clock In is unavailable because the scheduled start time has already passed. This shift is marked late.": "clockInLateError",
};

export default function ClockInButton({ shift }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleClockIn() {
    setMessage("");

    startTransition(async () => {
      try {
        await clockIn();
        setOpen(false);
        router.refresh();
      } catch (error) {
        const key = clockInMessages[error?.message];
        setMessage(key ? t(key) : error?.message || t("clockInError"));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className="primary-button"
        onClick={() => {
          setMessage("");
          setOpen(true);
        }}
      >
        {t("clockIn")}
      </button>

      {open && (
        <div
          className="staff-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isPending) {
              setOpen(false);
            }
          }}
        >
          <div className="staff-modal clock-in-modal">
            <div className="staff-modal-header">
              <div>
                <p className="eyebrow">{t("staffAttendance")}</p>
                <h2>{t("confirmClockIn")}</h2>
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

            <p className="clock-in-copy">
              {shift ? t("confirmClockInDescription") : t("clockInWithoutScheduledShiftDescription")}
            </p>

            {shift ? (
              <div className="clock-in-shift-summary">
                <div>
                  <span>{t("shift")}</span>
                  <strong>{shift.shift_name || t("noShiftAssigned")}</strong>
                </div>

                <div>
                  <span>{t("startTime")}</span>
                  <strong>{shift.start_time?.slice(0, 5) || "--:--"}</strong>
                </div>

                <div>
                  <span>{t("endTime")}</span>
                  <strong>{shift.end_time?.slice(0, 5) || "--:--"}</strong>
                </div>
              </div>
            ) : (
              <div className="clock-in-no-shift" role="status">
                {t("clockInWithoutScheduledShiftDescription")}
              </div>
            )}

            {message && (
              <div className="staff-form-error clock-in-error" role="alert">
                {message}
              </div>
            )}

            <div className="staff-form-actions clock-in-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                {t("cancel")}
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={handleClockIn}
                disabled={isPending}
              >
                {isPending ? t("clockingIn") : t("confirmClockIn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const clockOutMessages = {
  "You must clock in before you can clock out.": "clockOutNotClockedInError",
  "You are already clocked out for this shift.": "clockOutAlreadyError",
  "Active staff membership was not found for this restaurant.": "attendanceMembershipError",
};

export function ClockOutButton() {
  const { t } = useLanguage();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleClockOut() {
    setMessage("");
    startTransition(async () => {
      try {
        await clockOut();
        router.refresh();
      } catch (error) {
        const key = clockOutMessages[error?.message];
        setMessage(key ? t(key) : error?.message || t("clockOutError"));
      }
    });
  }

  return (
    <>
      <button type="button" className="secondary-button" onClick={handleClockOut} disabled={isPending}>
        {isPending ? t("clockingOut") : t("clockOut")}
      </button>
      {message && <span className="staff-message" role="alert">{message}</span>}
    </>
  );
}
