import { describe, it, expect } from "vitest";
import { computeGRS } from "./reliability.js";

function row(date, due, entries = []) {
  return { date, due, entries };
}
function entry(amount, recordedAt) {
  return { amount, recordedAt };
}

describe("computeGRS", () => {
  it("returns null below the minimum sample size", () => {
    const { score, sampleSize } = computeGRS({
      Alice: [row("2026-06-01", 1000, [entry(1000, "2026-06-01 09:00:00")])],
    });
    expect(score).toBeNull();
    expect(sampleSize).toBe(1);
  });

  it("scores 100 when every judged obligation across every member was on time", () => {
    const rowsComputedByMember = {
      Alice: [row("2026-06-01", 1000, [entry(1000, "2026-06-01 09:00:00")]), row("2026-06-15", 1000, [entry(1000, "2026-06-15 09:00:00")])],
      Bob: [row("2026-06-01", 1000, [entry(1000, "2026-06-01 09:00:00")]), row("2026-06-15", 1000, [entry(1000, "2026-06-15 09:00:00")])],
    };
    const { score, sampleSize } = computeGRS(rowsComputedByMember);
    expect(sampleSize).toBe(4);
    expect(score).toBe(100);
  });

  it("scores 0 when every judged obligation was missed", () => {
    const rowsComputedByMember = {
      Alice: [row("2026-06-01", 1000, []), row("2026-06-15", 1000, [])],
      Bob: [row("2026-06-01", 1000, []), row("2026-06-15", 1000, [])],
    };
    const { score, sampleSize } = computeGRS(rowsComputedByMember);
    expect(sampleSize).toBe(4);
    expect(score).toBe(0);
  });

  it("weights a late-but-paid obligation as half credit", () => {
    const rowsComputedByMember = {
      Alice: [row("2026-06-01", 1000, [entry(1000, "2026-06-01 09:00:00")]), row("2026-06-15", 1000, [entry(1000, "2026-06-15 09:00:00")])],
      Bob: [row("2026-06-01", 1000, [entry(1000, "2026-06-10 09:00:00")]), row("2026-06-15", 1000, [entry(1000, "2026-06-25 09:00:00")])],
    };
    const { score } = computeGRS(rowsComputedByMember);
    // 2 on-time (1 each) + 2 late (0.5 each) = 3 / 4 = 75%
    expect(score).toBe(75);
  });
});
