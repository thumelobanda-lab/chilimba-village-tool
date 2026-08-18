import { describe, it, expect } from "vitest";
import { findNextDue } from "./scheduleUtils.js";

const schedule = [
  { id: "d1", date: "2026-06-20", group: "GROUP 1", payees: ["Someone"], due: 1200 },
  { id: "d2", date: "2026-07-04", group: "GROUP 2", payees: ["Harriet"], due: 1200 },
  { id: "d3", date: "2026-07-18", group: "GROUP 3", payees: ["Someone Else"], due: 1500 },
];

describe("findNextDue", () => {
  it("finds the earliest date with an outstanding balance", () => {
    const result = findNextDue(schedule, "Fridah", true, {}, { d1: 0, d2: 0, d3: 0 });
    expect(result.row.id).toBe("d1");
    expect(result.balance).toBe(1200);
  });

  it("skips a date that's already fully paid and moves to the next one owed", () => {
    // d1 fully paid (balance 0), d2 and d3 still owed -> next is d2, the earlier of the two
    const result = findNextDue(schedule, "Fridah", true, {}, { d1: 1200, d2: 0, d3: 0 });
    expect(result.row.id).toBe("d2");
    expect(result.balance).toBe(1200);
  });

  it("skips the member's own payout date when recipients are exempt", () => {
    // d2 is Harriet's own date -> due resolves to 0 -> never a candidate regardless of paid amount
    const result = findNextDue(schedule, "Harriet", true, {}, { d1: 0, d2: 0, d3: 0 });
    expect(result.row.id).toBe("d1");
  });

  it("returns null when every date is settled", () => {
    const result = findNextDue(schedule, "Harriet", true, {}, { d1: 1200, d2: 0, d3: 1500 });
    expect(result).toBeNull();
  });

  it("applies a due override in place of the schedule default", () => {
    const result = findNextDue(schedule, "Fridah", true, { d1: 500 }, { d1: 0, d2: 0, d3: 0 });
    expect(result.row.id).toBe("d1");
    expect(result.due).toBe(500);
  });

  it("returns null for an empty schedule", () => {
    expect(findNextDue([], "Fridah", true, {}, {})).toBeNull();
  });

  it("skips a row with an unparseable date instead of throwing", () => {
    const badSchedule = [{ id: "bad", date: "not a date", group: "X", payees: [], due: 100 }];
    expect(() => findNextDue(badSchedule, "Fridah", true, {}, {})).not.toThrow();
    expect(findNextDue(badSchedule, "Fridah", true, {}, {})).toBeNull();
  });
});
