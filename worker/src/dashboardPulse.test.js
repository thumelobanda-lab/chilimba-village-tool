import { describe, it, expect } from "vitest";
import { computeGroupPulse } from "./dashboardPulse.js";

const nowMs = new Date("2026-08-20T12:00:00Z").getTime();

describe("computeGroupPulse", () => {
  it("sums only payments whose schedule row is in the current schedule", () => {
    const payments = [
      { amount: 200, scheduleRowId: "d1", userId: "u1", recordedAt: "2026-08-19T00:00:00Z" },
      { amount: 500, scheduleRowId: "old-row-not-in-schedule", userId: "u2", recordedAt: "2026-08-19T00:00:00Z" },
    ];
    const result = computeGroupPulse(payments, ["d1", "d2"], 5, nowMs);
    expect(result.totalContributed).toBe(200);
  });

  it("counts distinct members who paid in the last 7 days, not payment count", () => {
    const payments = [
      { amount: 100, scheduleRowId: "d1", userId: "u1", recordedAt: "2026-08-19T00:00:00Z" },
      { amount: 100, scheduleRowId: "d1", userId: "u1", recordedAt: "2026-08-18T00:00:00Z" }, // same member, 2nd payment
      { amount: 100, scheduleRowId: "d1", userId: "u2", recordedAt: "2026-08-15T00:00:00Z" },
    ];
    const result = computeGroupPulse(payments, ["d1"], 5, nowMs);
    expect(result.membersPaidThisWeek).toBe(2); // u1 and u2, not 3 payments
  });

  it("excludes a payment recorded more than 7 days ago from the weekly count", () => {
    const payments = [
      { amount: 100, scheduleRowId: "d1", userId: "u1", recordedAt: "2026-08-10T00:00:00Z" }, // 10 days before nowMs
    ];
    const result = computeGroupPulse(payments, ["d1"], 5, nowMs);
    expect(result.membersPaidThisWeek).toBe(0);
    expect(result.totalContributed).toBe(100); // still counted in the cycle total, just not "this week"
  });

  it("accepts scheduleRowIds as a plain array or a Set interchangeably", () => {
    const payments = [{ amount: 50, scheduleRowId: "d1", userId: "u1", recordedAt: "2026-08-19T00:00:00Z" }];
    const asArray = computeGroupPulse(payments, ["d1"], 1, nowMs);
    const asSet = computeGroupPulse(payments, new Set(["d1"]), 1, nowMs);
    expect(asArray).toEqual(asSet);
  });

  it("passes activeMemberCount straight through", () => {
    const result = computeGroupPulse([], [], 7, nowMs);
    expect(result.totalActiveMembers).toBe(7);
  });

  it("returns all zeros for no payments and an empty schedule", () => {
    expect(computeGroupPulse([], [], 0, nowMs)).toEqual({
      totalContributed: 0,
      membersPaidThisWeek: 0,
      totalActiveMembers: 0,
    });
  });

  it("treats a missing/non-numeric amount as 0 rather than NaN", () => {
    const payments = [
      { amount: 100, scheduleRowId: "d1", userId: "u1", recordedAt: "2026-08-19T00:00:00Z" },
      { scheduleRowId: "d1", userId: "u2", recordedAt: "2026-08-19T00:00:00Z" }, // no amount field
    ];
    const result = computeGroupPulse(payments, ["d1"], 2, nowMs);
    expect(result.totalContributed).toBe(100);
    expect(Number.isNaN(result.totalContributed)).toBe(false);
  });
});
