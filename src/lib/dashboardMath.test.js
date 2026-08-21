import { describe, it, expect } from "vitest";
import { computeCycleProgress, daysUntil, relativeDueLabel, sumFundBalances, buildCycleTimeline } from "./dashboardMath.js";

describe("computeCycleProgress", () => {
  it("returns all zeros for an empty schedule", () => {
    expect(computeCycleProgress([], "2026-08-20")).toEqual({ total: 0, passed: 0, percent: 0 });
  });

  it("counts a date on today as passed", () => {
    const schedule = [{ date: "2026-08-20" }, { date: "2026-09-03" }];
    expect(computeCycleProgress(schedule, "2026-08-20")).toEqual({ total: 2, passed: 1, percent: 50 });
  });

  it("counts none passed when every date is in the future", () => {
    const schedule = [{ date: "2026-09-01" }, { date: "2026-09-15" }];
    expect(computeCycleProgress(schedule, "2026-08-20")).toEqual({ total: 2, passed: 0, percent: 0 });
  });

  it("counts all passed when every date is behind today", () => {
    const schedule = [{ date: "2026-01-01" }, { date: "2026-02-01" }, { date: "2026-03-01" }];
    expect(computeCycleProgress(schedule, "2026-08-20")).toEqual({ total: 3, passed: 3, percent: 100 });
  });

  it("ignores rows with an unparsable date rather than throwing", () => {
    const schedule = [{ date: "2026-01-01" }, { date: "not-a-date" }];
    expect(computeCycleProgress(schedule, "2026-08-20")).toEqual({ total: 2, passed: 1, percent: 50 });
  });
});

describe("daysUntil", () => {
  it("is 0 for today", () => {
    expect(daysUntil("2026-08-20", "2026-08-20")).toBe(0);
  });

  it("is positive for a future date", () => {
    expect(daysUntil("2026-08-25", "2026-08-20")).toBe(5);
  });

  it("is negative for a past date (overdue)", () => {
    expect(daysUntil("2026-08-15", "2026-08-20")).toBe(-5);
  });
});

describe("relativeDueLabel", () => {
  it("labels an overdue date", () => {
    expect(relativeDueLabel(-3)).toBe("3d overdue");
  });

  it("labels today", () => {
    expect(relativeDueLabel(0)).toBe("due today");
  });

  it("labels tomorrow", () => {
    expect(relativeDueLabel(1)).toBe("due tomorrow");
  });

  it("labels further-out dates as 'in N days'", () => {
    expect(relativeDueLabel(9)).toBe("in 9 days");
  });
});

describe("sumFundBalances", () => {
  it("sums balances across funds", () => {
    expect(sumFundBalances([{ balance: 100 }, { balance: 250 }])).toBe(350);
  });

  it("treats a missing/non-numeric balance as 0 instead of NaN", () => {
    expect(sumFundBalances([{ balance: 100 }, {}, { balance: "oops" }])).toBe(100);
  });

  it("returns 0 for an empty or missing list", () => {
    expect(sumFundBalances([])).toBe(0);
    expect(sumFundBalances(undefined)).toBe(0);
  });
});

describe("buildCycleTimeline", () => {
  it("returns an empty array for an empty schedule", () => {
    expect(buildCycleTimeline([], "2026-08-20")).toEqual([]);
  });

  it("tags a date on today as past, not next", () => {
    const schedule = [{ id: "a", date: "2026-08-20" }, { id: "b", date: "2026-09-03" }];
    const result = buildCycleTimeline(schedule, "2026-08-20");
    expect(result[0].status).toBe("past");
    expect(result[1].status).toBe("next");
  });

  it("marks only the single earliest future date as next, the rest future", () => {
    const schedule = [
      { id: "a", date: "2026-08-01" }, // past
      { id: "b", date: "2026-08-15" }, // past
      { id: "c", date: "2026-08-29" }, // next
      { id: "d", date: "2026-09-12" }, // future
    ];
    const result = buildCycleTimeline(schedule, "2026-08-20");
    expect(result.map((r) => r.status)).toEqual(["past", "past", "next", "future"]);
  });

  it("marks every date past when the whole schedule is behind today", () => {
    const schedule = [{ id: "a", date: "2026-01-01" }, { id: "b", date: "2026-02-01" }];
    const result = buildCycleTimeline(schedule, "2026-08-20");
    expect(result.map((r) => r.status)).toEqual(["past", "past"]);
  });

  it("marks the earliest date next when the whole schedule is still ahead", () => {
    const schedule = [{ id: "a", date: "2026-09-01" }, { id: "b", date: "2026-09-15" }];
    const result = buildCycleTimeline(schedule, "2026-08-20");
    expect(result.map((r) => r.status)).toEqual(["next", "future"]);
  });

  it("preserves every other field on each row, only adding status", () => {
    const schedule = [{ id: "a", date: "2026-09-01", group: "Group A", payees: ["Doreen"] }];
    const result = buildCycleTimeline(schedule, "2026-08-20");
    expect(result[0]).toEqual({ id: "a", date: "2026-09-01", group: "Group A", payees: ["Doreen"], status: "next" });
  });

  it("ignores rows with an unparsable date rather than throwing, treating them as not-past", () => {
    const schedule = [{ id: "a", date: "2026-01-01" }, { id: "b", date: "not-a-date" }];
    const result = buildCycleTimeline(schedule, "2026-08-20");
    expect(result.map((r) => r.status)).toEqual(["past", "next"]);
  });
});
