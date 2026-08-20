import { describe, it, expect } from "vitest";
import { simpleInterestAt, buildProjectionSchedule, DEFAULT_PROJECTION_MILESTONE_MONTHS } from "./interestMath.js";

describe("simpleInterestAt", () => {
  it("computes I = P × r × t for a full year", () => {
    const result = simpleInterestAt(1000, 10, 12); // K1000 at 10%/yr for 12 months
    expect(result.interest).toBe(100);
    expect(result.projectedTotal).toBe(1100);
    expect(result.months).toBe(12);
  });

  it("prorates for a partial year", () => {
    const result = simpleInterestAt(1000, 10, 6); // half a year
    expect(result.interest).toBe(50);
    expect(result.projectedTotal).toBe(1050);
  });

  it("returns the principal unchanged at 0% rate", () => {
    const result = simpleInterestAt(1000, 0, 12);
    expect(result.interest).toBe(0);
    expect(result.projectedTotal).toBe(1000);
  });

  it("returns zero interest on a zero principal", () => {
    const result = simpleInterestAt(0, 25, 12);
    expect(result.interest).toBe(0);
    expect(result.projectedTotal).toBe(0);
  });

  it("returns zero interest at zero months out", () => {
    const result = simpleInterestAt(1000, 10, 0);
    expect(result.interest).toBe(0);
    expect(result.projectedTotal).toBe(1000);
  });

  it("treats non-numeric principal/rate/months as 0 rather than NaN", () => {
    const result = simpleInterestAt(undefined, "oops", null);
    expect(result.interest).toBe(0);
    expect(result.projectedTotal).toBe(0);
    expect(Number.isNaN(result.interest)).toBe(false);
  });

  it("compounds linearly, not exponentially, across doubled time", () => {
    const oneYear = simpleInterestAt(1000, 10, 12);
    const twoYears = simpleInterestAt(1000, 10, 24);
    expect(twoYears.interest).toBe(oneYear.interest * 2); // simple interest, not compound
  });
});

describe("buildProjectionSchedule", () => {
  it("returns one projection per default milestone, in order", () => {
    const schedule = buildProjectionSchedule(1000, 10);
    expect(schedule.map((p) => p.months)).toEqual(DEFAULT_PROJECTION_MILESTONE_MONTHS);
    expect(schedule).toHaveLength(4);
  });

  it("each entry matches simpleInterestAt for the same inputs", () => {
    const schedule = buildProjectionSchedule(2000, 15, [1, 12]);
    expect(schedule[0]).toEqual(simpleInterestAt(2000, 15, 1));
    expect(schedule[1]).toEqual(simpleInterestAt(2000, 15, 12));
  });

  it("accepts a custom milestone list", () => {
    const schedule = buildProjectionSchedule(1000, 10, [1, 2, 3]);
    expect(schedule.map((p) => p.months)).toEqual([1, 2, 3]);
  });
});
