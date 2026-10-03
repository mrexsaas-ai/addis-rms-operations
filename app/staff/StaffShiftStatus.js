"use client";

import { useLanguage } from "../i18n/LanguageProvider";
import { formatBusinessTime, formatShiftTime } from "./attendanceSelection";

export default function StaffShiftStatus({ person }) {
  const { t } = useLanguage();
  const shift = person.shift;

  return (
    <>
      <td>
        {shift ? (
          <>
            <div>{shift.shift_date || t("noDate")}</div>
            <small>{t("startTime")}: {formatShiftTime(shift.start_time)} · {t("endTime")}: {formatShiftTime(shift.end_time)}</small>
            {shift.clock_in_at && <small>{t("clockedInAt")}: {formatBusinessTime(shift.clock_in_at)}</small>}
            {shift.clock_out_at && <small>{t("clockedOutAt")}: {formatBusinessTime(shift.clock_out_at)}</small>}
          </>
        ) : t("noShift")}
      </td>
      <td>
        <span className={`status-badge ${person.dutyStatus === "CLOCKED_IN" ? "status-completed" : person.dutyStatus === "CLOCKED_OUT" ? "status-ready" : "status-cancelled"}`}>
          {person.dutyStatus === "CLOCKED_IN" ? t("clockedIn") : person.dutyStatus === "CLOCKED_OUT" ? t("clockedOut") : t("offDuty")}
        </span>
        {shift?.late && !shift.clock_in_at && <span className="status-badge status-late">{t("late")}</span>}
      </td>
    </>
  );
}