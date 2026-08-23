import { describe, it, expect } from "vitest";
import { computeMemberStreak } from "./streakMath.js";

function row(date, due, entries = []) {
  return { date, due, entries };
}
function entry(amount, recordedAt, voidedAt = null) {
  return { amount, recordedAt, voidedAt };
}

describe("computeMemberStreak", () => {
  it("classifies a fully on-time payment as 'on-time'", () => {
    const rows = [row("2026-06-01", 1000, [entry(1000, "2026-06-01 09:00:00")])];
    const { dots } = computeMemberStreak(rows, "2026-08-01");
    expect(dots[0].status).toBe("on-time");
  });

  it("classifies a payment that only crosses the due amount after the due date as 'late'", () => {
    const rows = [
      row("2026-06-01", 1000, [entry(500, "2026-05-30 09:00:00"), entry(500, "2026-06-05 09:00:00")]),
    ];
    const { dots } = computeMemberStreak(rows, "2026-08-01");
    expect(dots[0].status).toBe("late");
  });

  it("classifies a past date with nothing paid as 'missed'", () => {
    const rows = [row("2026-06-01", 1000, [])];
    const { dots } = computeMemberStreak(rows, "2026-08-01");
    expect(dots[0].status).toBe("missed");
  });

  it("skips a row with due 0 (e.g. own exempt payout date) entirely", () => {
    const rows = [row("2026-06-01", 0, [])];
    const { dots } = computeMemberStreak(rows, "2026-08-01");
    expect(dots).toEqual([]);
  });

  it("skips a future date entirely, not counting it as missed", () => {
    const rows = [row("2026-09-01", 1000, [])];
    const { dots } = computeMemberStreak(rows, "2026-08-01");
    expect(dots).toEqual([]);
  });

  it("ignores a voided entry when finding the crossing point", () => {
    const rows = [row("2026-06-01", 1000, [entry(1000, "2026-05-30 09:00:00", "2026-05-31 00:00:00")])];
    const { dots } = computeMemberStreak(rows, "2026-08-01");
    expect(dots[0].status).toBe("missed");
  });

  it("current streak: a late-but-paid date does not break the streak", () => {
    const rows = [
      row("2026-06-01", 1000, [entry(1000, "2026-06-01 09:00:00")]), // on-time
      row("2026-06-15", 1000, [entry(1000, "2026-06-20 09:00:00")]), // late
      row("2026-06-29", 1000, [entry(1000, "2026-06-29 09:00:00")]), // on-time
    ];
    const { currentStreak } = computeMemberStreak(rows, "2026-08-01");
    expect(currentStreak).toBe(3);
  });

  it("current streak: a missed date resets the count from that point forward", () => {
    const rows = [
      row("2026-06-01", 1000, [entry(1000, "2026-06-01 09:00:00")]), // on-time
      row("2026-06-15", 1000, []), // missed
      row("2026-06-29", 1000, [entry(1000, "2026-06-29 09:00:00")]), // on-time
    ];
    const { currentStreak, dots } = computeMemberStreak(rows, "2026-08-01");
    expect(dots[1].status).toBe("missed");
    expect(currentStreak).toBe(1); // only the last (06-29) date counts back
  });

  it("returns an empty streak when there are no past rows yet", () => {
    const { dots, currentStreak } = computeMemberStreak([row("2026-09-01", 1000, [])], "2026-01-01");
    expect(dots).toEqual([]);
    expect(currentStreak).toBe(0);
  });
});
