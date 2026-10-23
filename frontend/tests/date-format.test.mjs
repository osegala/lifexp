import assert from "node:assert/strict";
import test from "node:test";
import { formatDate, formatTime, parseDisplayDate, parseDisplayTime } from "../src/utils/dateFormat.ts";

test("local calendar days never shift while timestamp dates use the saved timezone", () => {
  for (const timeZone of ["America/New_York", "Pacific/Auckland", "Pacific/Honolulu"]) {
    assert.equal(formatDate("2026-10-20", { timeZone }), "Tuesday, Oct 20");
  }
  assert.equal(formatDate("2026-10-20T01:00:00Z", { timeZone: "America/New_York" }), "Monday, Oct 19");
  assert.equal(formatDate("2026-10-20T01:00:00Z", { timeZone: "Pacific/Auckland" }), "Tuesday, Oct 20");
  assert.equal(formatDate("2026-10-20", { year: true }), "Oct 20, 2026");
  assert.equal(formatDate("2026-02-30"), "Date unavailable");
  assert.equal(formatDate("bad"), "Date unavailable");
});

test("friendly schedule values round-trip to unchanged canonical storage including noon, midnight and leap days", () => {
  for (const value of ["00:00", "09:30", "12:00", "23:59"]) assert.equal(parseDisplayTime(formatTime(value)), value);
  for (const value of ["2024-02-29", "2026-10-20"]) assert.equal(parseDisplayDate(formatDate(value, { year: true })), value);
  assert.equal(parseDisplayDate("October 20, 2026"), "2026-10-20");
  assert.equal(parseDisplayDate("Feb 29, 2026"), null);
  assert.equal(parseDisplayDate("Februbbish 20, 2026"), null);
  assert.equal(parseDisplayTime("13:00 PM"), null);
  assert.equal(parseDisplayTime("9:60 AM"), null);
  assert.equal(parseDisplayDate(""), "");
  assert.equal(parseDisplayTime(""), "");
});
