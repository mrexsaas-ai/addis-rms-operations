"use client";

import { useLanguage } from "../i18n/LanguageProvider";
import { clockIn, clockOut } from "../staff/actions";
import { formatBusinessTime, formatShiftTime, getAttendanceStatus } from "../staff/attendanceSelection";

export default function ServerAttendance({ shift }) {
  const { t } = useLanguage();
  const status = getAttendanceStatus(shift);

  return (
    <section className="server-attendance-panel panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t("staffAttendance")}</p>
          <h2>{t("todaysShift")}</h2>
        </div>

        <span className={`status-badge ${status === "CLOCKED_IN" ? "status-completed" : status === "CLOCKED_OUT" ? "status-ready" : "status-cancelled"}`}>
          {status === "CLOCKED_IN" ? t("clockedIn") : status === "CLOCKED_OUT" ? t("clockedOut") : t("offDuty")}
        </span>
      </div>

      {shift ? (
        <>
          <p>{shift.shift_name || t("scheduledShift")}</p>
          <p>{t("startTime")}: {formatShiftTime(shift.start_time)} · {t("endTime")}: {formatShiftTime(shift.end_time)}</p>
          {shift.clock_in_at && <p>{t("clockedInAt")}: {formatBusinessTime(shift.clock_in_at)}</p>}
          {shift.clock_out_at && <p>{t("clockedOutAt")}: {formatBusinessTime(shift.clock_out_at)}</p>}
          {shift.late && !shift.clock_in_at && <p>{t("late")}</p>}

          <div className="staff-row-actions">
            {status === "CLOCKED_IN" ? (
              <form action={clockOut}>
                <button type="submit" className="secondary-button">{t("clockOut")}</button>
              </form>
            ) : status === "OFF_DUTY" && shift.status !== "COMPLETED" && shift.status !== "CANCELLED" ? (
              <form action={clockIn}>
                <button type="submit" className="primary-button">{t("clockIn")}</button>
              </form>
            ) : null}
          </div>
        </>
      ) : (
        <p>{t("noShift")}</p>
      )}
    </section>
  );
}