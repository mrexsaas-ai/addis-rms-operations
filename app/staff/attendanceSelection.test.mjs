import assert from "node:assert/strict";
import test from "node:test";
import {
  getAttendanceStatus,
  getBusinessDateKey,
  selectAttendanceShift,
  toBusinessInstant,
} from "./attendanceSelection.js";

function shift(overrides = {}) {
  return {
    id: "shift-1",
    status: "SCHEDULED",
    shift_date: "2026-09-25",
    start_time: "09:00:00",
    end_time: "17:00:00",
    clock_in_at: null,
    clock_out_at: null,
    ...overrides,
  };
}

test("business date follows Addis Ababa at UTC day boundaries", () => {
  assert.equal(getBusinessDateKey(new Date("2026-09-24T21:30:00.000Z")), "2026-09-25");
  assert.equal(getBusinessDateKey(new Date("2026-09-25T21:30:00.000Z")), "2026-09-26");
});

test("scheduled wall time converts to an instant that displays in Addis time", () => {
  const instant = toBusinessInstant("2026-09-25", "09:00:00");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Addis_Ababa",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(instant));
  const localTime = `${parts.find((part) => part.type === "hour")?.value}:${parts.find((part) => part.type === "minute")?.value}`;

  assert.equal(localTime, "09:00");
  assert.equal(getBusinessDateKey(new Date(instant)), "2026-09-25");
});

test("active attendance wins over future shifts and current-window shifts beat future shifts", () => {
  const currentInstant = toBusinessInstant("2026-09-25", "12:00:00");
  const futureShift = shift({ id: "future", start_time: "18:00:00", end_time: "22:00:00" });
  const currentShift = shift({ id: "current", start_time: "09:00:00", end_time: "17:00:00" });
  const activeShift = shift({ id: "active", clock_in_at: new Date(currentInstant - 60_000).toISOString() });

  assert.equal(selectAttendanceShift([futureShift, currentShift], currentInstant)?.id, "current");
  assert.equal(selectAttendanceShift([futureShift, currentShift, activeShift], currentInstant)?.id, "active");
});

test("a valid past unclocked shift remains selected for late attendance", () => {
  const currentInstant = toBusinessInstant("2026-09-25", "18:00:00");
  const missedShift = shift({ id: "missed", end_time: "17:00:00" });
  const cancelledShift = shift({ id: "cancelled", status: "CANCELLED" });

  assert.equal(selectAttendanceShift([missedShift, cancelledShift], currentInstant)?.id, "missed");
  assert.equal(selectAttendanceShift([cancelledShift], currentInstant), null);
});

test("staff without any scheduled shift can start from an empty attendance list", () => {
  assert.equal(selectAttendanceShift([]), null);
});

test("active unscheduled attendance remains selected without schedule times", () => {
  const activeAttendance = shift({
    id: "unscheduled-active",
    status: "UNSCHEDULED",
    start_time: null,
    end_time: null,
    clock_in_at: "2026-09-25T06:00:00.000Z",
  });

  assert.equal(selectAttendanceShift([activeAttendance])?.id, "unscheduled-active");
});

test("attendance state comes only from persisted clock timestamps", () => {
  assert.equal(getAttendanceStatus(null), "OFF_DUTY");
  assert.equal(getAttendanceStatus(shift()), "OFF_DUTY");
  assert.equal(getAttendanceStatus(shift({ clock_in_at: "2026-09-25T06:00:00.000Z" })), "CLOCKED_IN");
  assert.equal(getAttendanceStatus(shift({
    clock_in_at: "2026-09-25T06:00:00.000Z",
    clock_out_at: "2026-09-25T14:00:00.000Z",
  })), "CLOCKED_OUT");
});