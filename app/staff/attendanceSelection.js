const BUSINESS_TIMEZONE = "Africa/Addis_Ababa";

export function getBusinessDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((entry) => entry.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatShiftTime(value) {
  return String(value || "").slice(0, 5) || "--:--";
}

export function formatBusinessTime(value) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getAttendanceStatus(shift) {
  if (shift?.clock_in_at && !shift.clock_out_at) return "CLOCKED_IN";
  if (shift?.clock_in_at && shift.clock_out_at) return "CLOCKED_OUT";
  return "OFF_DUTY";
}

function getBusinessTimezoneOffsetMinutes(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    timeZoneName: "shortOffset",
  });
  const tzName = formatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value || "GMT";
  const match = tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2] || 0) * 60 + Number(match[3] || 0));
}

export function toBusinessInstant(dateKey, timeValue) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  const [hour, minute, second = 0] = String(timeValue).split(":").map(Number);
  const utcTimestampMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMinutes = getBusinessTimezoneOffsetMinutes(new Date(utcTimestampMs));
  return utcTimestampMs - offsetMinutes * 60 * 1000;
}

export function selectAttendanceShift(shifts, now = Date.now()) {
  const eligibleShifts = shifts.filter((shift) => shift.status !== "CANCELLED");
  const unclockedShifts = eligibleShifts.filter(
    (shift) => !shift.clock_in_at && !shift.clock_out_at && shift.status !== "COMPLETED"
  );
  const byStartAscending = (left, right) =>
    toBusinessInstant(left.shift_date, left.start_time) -
    toBusinessInstant(right.shift_date, right.start_time);
  const byStartDescending = (left, right) => byStartAscending(right, left);
  const inProgressShifts = unclockedShifts
    .filter((shift) => {
      const start = toBusinessInstant(shift.shift_date, shift.start_time);
      const end = toBusinessInstant(shift.shift_date, shift.end_time);
      return start <= now && now <= end;
    })
    .sort(byStartAscending);
  const futureShifts = unclockedShifts
    .filter((shift) => toBusinessInstant(shift.shift_date, shift.start_time) > now)
    .sort(byStartAscending);
  const completedAttendance = eligibleShifts
    .filter((shift) => shift.clock_in_at && shift.clock_out_at)
    .sort(byStartDescending);
  const pastUnclockedShifts = unclockedShifts
    .filter((shift) => toBusinessInstant(shift.shift_date, shift.start_time) <= now)
    .sort(byStartDescending);
  return (
    eligibleShifts.find((shift) => shift.clock_in_at && !shift.clock_out_at) ||
    inProgressShifts[0] ||
    futureShifts[0] ||
    completedAttendance[0] ||
    pastUnclockedShifts[0] ||
    null
  );
}