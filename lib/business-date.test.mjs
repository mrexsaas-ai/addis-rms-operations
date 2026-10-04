import assert from "node:assert/strict";
import test from "node:test";
import { getBusinessDateKey, toBusinessInstant } from "../app/staff/attendanceSelection.js";
import { businessDateKeyFor, shiftBusinessDate } from "./business-date.mjs";

test("business calendar-day arithmetic crosses months, years, and leap day", () => {
  assert.equal(shiftBusinessDate("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftBusinessDate("2024-03-01", -1), "2024-02-29");
  assert.equal(businessDateKeyFor(2026, 12, 1), "2027-01-01");
});

test("Addis business midnight maps to UTC instants without using host-local time", () => {
  assert.equal(getBusinessDateKey(new Date("2026-10-01T20:59:59.999Z")), "2026-10-01");
  assert.equal(getBusinessDateKey(new Date("2026-10-01T21:00:00.000Z")), "2026-10-02");
  assert.equal(new Date(toBusinessInstant("2026-10-02", "00:00:00")).toISOString(), "2026-10-01T21:00:00.000Z");
  assert.equal(new Date(toBusinessInstant(shiftBusinessDate("2026-10-02", 1), "00:00:00")).toISOString(), "2026-10-02T21:00:00.000Z");
});