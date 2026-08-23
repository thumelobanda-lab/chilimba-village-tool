import { describe, it, expect } from "vitest";
import { computeGRS, classifyLifecycleStage, countPastScheduleDates, computeOutstandingOverdueBalance } from "./reliability.js";

// Payee is a third person outside `members`, so neither Alice nor Bob is
// ever the exempt recipient — each owes on both dates, giving a clean
// 2 members x 2 dates = 4 judged obligations to build round-number
// expectations from.
const schedule = [
  { id: "d1", date: "2026-06-01", payees: ["Someone Else"], due: 1000 },
  { id: "d2", date: "2026-06-15", payees: ["Someone Else"], due: 1000 },
];
const members = ["Alice", "Bob"];

function entry(memberName, scheduleRowId, amount, recordedAt) {
  return { memberName, scheduleRowId, amount, recordedAt };
}

describe("computeGRS", () => {
  it("returns null (not enough history) below the minimum sample size", () => {
    const oneDate = [{ id: "d1", date: "2026-06-01", payees: ["Alice"], due: 1000 }];
    const { score, sampleSize } = computeGRS(oneDate, [], ["Bob"], true, {}, "2026-08-01");
    // Alice is exempt as recipient (skipped), Bob has one judged date -> sampleSize 1, below min 3
    expect(score).toBeNull();
    expect(sampleSize).toBe(1);
  });

  it("scores 100 when every judged obligation was paid on time", () => {
    const payments = [
      entry("Alice", "d1", 1000, "2026-06-01 09:00:00"),
      entry("Alice", "d2", 1000, "2026-06-15 09:00:00"),
      entry("Bob", "d1", 1000, "2026-06-01 09:00:00"),
      entry("Bob", "d2", 1000, "2026-06-15 09:00:00"),
    ];
    const { score, sampleSize } = computeGRS(schedule, payments, members, true, {}, "2026-08-01");
    expect(sampleSize).toBe(4);
    expect(score).toBe(100);
  });

  it("scores 0 when every judged obligation was missed", () => {
    const { score, sampleSize } = computeGRS(schedule, [], members, true, {}, "2026-08-01");
    expect(sampleSize).toBe(4);
    expect(score).toBe(0);
  });

  it("weights a late-but-paid obligation as half credit, not zero and not full", () => {
    const payments = [
      entry("Alice", "d1", 1000, "2026-06-01 09:00:00"), // on time
      entry("Alice", "d2", 1000, "2026-06-15 09:00:00"), // on time
      entry("Bob", "d1", 1000, "2026-06-10 09:00:00"), // due 06-01, late
      entry("Bob", "d2", 1000, "2026-06-25 09:00:00"), // due 06-15, late
    ];
    const { score } = computeGRS(schedule, payments, members, true, {}, "2026-08-01");
    // 4 judged obligations: 2 on-time (1 each) + 2 late (0.5 each) = 3.0 / 4 = 75%
    expect(score).toBe(75);
  });

  it("counts a member with zero payments toward a lower score, not excluding them", () => {
    const single = [{ id: "d1", date: "2026-06-01", payees: ["Other"], due: 1000 }];
    const { score, sampleSize } = computeGRS(single, [], ["Alice", "Bob", "Carol"], true, {}, "2026-08-01");
    expect(sampleSize).toBe(3);
    expect(score).toBe(0);
  });
});

describe("classifyLifecycleStage", () => {
  const now = new Date("2026-08-01T00:00:00Z");

  it("is 'new' for a group created recently, regardless of GRS", () => {
    expect(
      classifyLifecycleStage({
        createdAt: "2026-07-20T00:00:00Z",
        pastScheduleDateCount: 5,
        grs: { score: 10 },
        outstandingOverdueBalance: 500,
        now,
      })
    ).toBe("new");
  });

  it("is 'new' when too few schedule dates have passed, even for an older group", () => {
    expect(
      classifyLifecycleStage({
        createdAt: "2026-01-01T00:00:00Z",
        pastScheduleDateCount: 1,
        grs: { score: 90 },
        outstandingOverdueBalance: 0,
        now,
      })
    ).toBe("new");
  });

  it("is 'at_risk' when GRS is low AND there's an outstanding overdue balance", () => {
    expect(
      classifyLifecycleStage({
        createdAt: "2026-01-01T00:00:00Z",
        pastScheduleDateCount: 10,
        grs: { score: 30 },
        outstandingOverdueBalance: 1200,
        now,
      })
    ).toBe("at_risk");
  });

  it("is 'active', not 'at_risk', when GRS is low but the group is fully caught up now", () => {
    expect(
      classifyLifecycleStage({
        createdAt: "2026-01-01T00:00:00Z",
        pastScheduleDateCount: 10,
        grs: { score: 30 },
        outstandingOverdueBalance: 0,
        now,
      })
    ).toBe("active");
  });

  it("is 'active' when GRS is healthy even with some outstanding balance", () => {
    expect(
      classifyLifecycleStage({
        createdAt: "2026-01-01T00:00:00Z",
        pastScheduleDateCount: 10,
        grs: { score: 85 },
        outstandingOverdueBalance: 200,
        now,
      })
    ).toBe("active");
  });

  it("is 'active' (not 'at_risk') when GRS is null (no score yet) but the group is old enough", () => {
    expect(
      classifyLifecycleStage({
        createdAt: "2026-01-01T00:00:00Z",
        pastScheduleDateCount: 10,
        grs: { score: null },
        outstandingOverdueBalance: 500,
        now,
      })
    ).toBe("active");
  });
});

describe("countPastScheduleDates", () => {
  it("counts only dates on or before today", () => {
    const sched = [
      { id: "d1", date: "2026-06-01" },
      { id: "d2", date: "2026-06-15" },
      { id: "d3", date: "2026-07-01" },
    ];
    expect(countPastScheduleDates(sched, "2026-06-15")).toBe(2);
  });

  it("returns 0 for an empty schedule", () => {
    expect(countPastScheduleDates([], "2026-06-15")).toBe(0);
  });
});

describe("computeOutstandingOverdueBalance", () => {
  it("sums what's still owed on past-due dates, clamping each member-row to zero", () => {
    const sched = [
      { id: "d1", date: "2026-06-01", payees: ["Someone Else"], due: 1000 },
      { id: "d2", date: "2026-06-15", payees: ["Someone Else"], due: 1000 },
    ];
    const payments = [
      entry("Alice", "d1", 1500), // overpaid d1 by 500
      entry("Bob", "d2", 400), // underpaid d2 by 600 (owes on d2 too, Alice owes d2 as well)
    ];
    // Alice: d1 paid 1500 (clamped 0 owed), d2 paid 0 (owes 1000)
    // Bob: d1 paid 0 (owes 1000), d2 paid 400 (owes 600)
    // Total = 0 + 1000 + 1000 + 600 = 2600 — Alice's d1 overpayment never offsets anyone else's shortfall
    const total = computeOutstandingOverdueBalance(sched, payments, ["Alice", "Bob"], true, "2026-08-01");
    expect(total).toBe(2600);
  });

  it("returns 0 when every past obligation is fully paid", () => {
    const sched = [{ id: "d1", date: "2026-06-01", payees: ["Someone Else"], due: 1000 }];
    const payments = [entry("Alice", "d1", 1000), entry("Bob", "d1", 1000)];
    expect(computeOutstandingOverdueBalance(sched, payments, ["Alice", "Bob"], true, "2026-08-01")).toBe(0);
  });

  it("ignores future dates entirely", () => {
    const sched = [{ id: "d1", date: "2026-09-01", payees: ["Someone Else"], due: 1000 }];
    expect(computeOutstandingOverdueBalance(sched, [], ["Alice"], true, "2026-08-01")).toBe(0);
  });

  it("skips a member's own exempt payout-date row", () => {
    const sched = [{ id: "d1", date: "2026-06-01", payees: ["Alice"], due: 1000 }];
    expect(computeOutstandingOverdueBalance(sched, [], ["Alice"], true, "2026-08-01")).toBe(0);
  });
});
