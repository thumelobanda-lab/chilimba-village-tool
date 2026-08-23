import { describe, it, expect } from "vitest";
import { computeMemberStreak } from "./streakMath.js";

const schedule = [
  { id: "d1", date: "2026-06-01", payees: ["Other"], due: 1000 },
  { id: "d2", date: "2026-06-15", payees: ["Other"], due: 1000 },
  { id: "d3", date: "2026-06-29", payees: ["Other"], due: 1000 },
  { id: "d4", date: "2026-07-13", payees: ["Fridah"], due: 1000 }, // Fridah's own payout date
  { id: "d5", date: "2026-07-27", payees: ["Other"], due: 1000 },
];

function entry(scheduleRowId, amount, recordedAt, voidedAt = null) {
  return { scheduleRowId, amount, recordedAt, voidedAt };
}

describe("computeMemberStreak", () => {
  it("classifies a fully on-time payment as 'on-time'", () => {
    const { dots } = computeMemberStreak(
      schedule,
      [entry("d1", 1000, "2026-06-01 09:00:00")],
      "Fridah",
      true,
      {},
      "2026-08-01"
    );
    expect(dots.find((d) => d.date === "2026-06-01").status).toBe("on-time");
  });

  it("classifies a payment that only crosses the due amount AFTER the due date as 'late'", () => {
    const { dots } = computeMemberStreak(
      schedule,
      [entry("d1", 500, "2026-05-30 09:00:00"), entry("d1", 500, "2026-06-05 09:00:00")],
      "Fridah",
      true,
      {},
      "2026-08-01"
    );
    expect(dots.find((d) => d.date === "2026-06-01").status).toBe("late");
  });

  it("classifies a past date with nothing (or not enough) paid as 'missed'", () => {
    const { dots } = computeMemberStreak(schedule, [], "Fridah", true, {}, "2026-08-01");
    expect(dots.find((d) => d.date === "2026-06-01").status).toBe("missed");
  });

  it("skips the member's own exempt payout-date row entirely", () => {
    const { dots } = computeMemberStreak(schedule, [], "Fridah", true, {}, "2026-08-01");
    expect(dots.find((d) => d.date === "2026-07-13")).toBeUndefined();
  });

  it("skips a future date entirely, not counting it as missed", () => {
    const { dots } = computeMemberStreak(schedule, [], "Fridah", true, {}, "2026-06-10");
    expect(dots.find((d) => d.date === "2026-06-15")).toBeUndefined();
    expect(dots.find((d) => d.date === "2026-06-29")).toBeUndefined();
  });

  it("ignores a voided entry entirely when determining the crossing point", () => {
    const { dots } = computeMemberStreak(
      schedule,
      [entry("d1", 1000, "2026-05-30 09:00:00", "2026-05-31 00:00:00")],
      "Fridah",
      true,
      {},
      "2026-08-01"
    );
    expect(dots.find((d) => d.date === "2026-06-01").status).toBe("missed");
  });

  it("respects a per-member due override when deciding whether the amount was crossed", () => {
    const { dots } = computeMemberStreak(
      schedule,
      [entry("d1", 400, "2026-06-01 09:00:00")],
      "Fridah",
      true,
      { d1: 400 },
      "2026-08-01"
    );
    expect(dots.find((d) => d.date === "2026-06-01").status).toBe("on-time");
  });

  it("current streak: a late-but-paid date does NOT break the streak", () => {
    const { currentStreak } = computeMemberStreak(
      schedule,
      [
        entry("d1", 1000, "2026-06-01 09:00:00"), // on-time
        entry("d2", 1000, "2026-06-20 09:00:00"), // late (due 06-15)
        entry("d3", 1000, "2026-06-29 09:00:00"), // on-time
        entry("d5", 1000, "2026-07-27 09:00:00"), // on-time
      ],
      "Fridah",
      true,
      {},
      "2026-08-01"
    );
    // d4 is Fridah's own exempt row, skipped — judged rows are d1,d2,d3,d5, all non-missed
    expect(currentStreak).toBe(4);
  });

  it("current streak: a missed date resets the count to zero from that point forward", () => {
    const { currentStreak, dots } = computeMemberStreak(
      schedule,
      [
        entry("d1", 1000, "2026-06-01 09:00:00"), // on-time
        // d2 missed entirely
        entry("d3", 1000, "2026-06-29 09:00:00"), // on-time
        entry("d5", 1000, "2026-07-27 09:00:00"), // on-time
      ],
      "Fridah",
      true,
      {},
      "2026-08-01"
    );
    expect(dots.find((d) => d.date === "2026-06-15").status).toBe("missed");
    // Only d3 and d5 count — the streak doesn't reach back past the miss on d2
    expect(currentStreak).toBe(2);
  });

  it("returns an empty streak for a schedule with no past dates yet", () => {
    const { dots, currentStreak } = computeMemberStreak(schedule, [], "Fridah", true, {}, "2026-01-01");
    expect(dots).toEqual([]);
    expect(currentStreak).toBe(0);
  });
});
