import { describe, it, expect } from "vitest";
import { getPayees, payeesLabel, isRecipient, resolveDue, findNextDue, myNextDueDates, generateScheduleDates, cycleEndDate, unassignedMembers } from "./scheduleUtils.js";

describe("getPayees", () => {
  it("reads a payees array directly", () => {
    expect(getPayees({ payees: ["Doreen", "Dorothy"] })).toEqual(["Doreen", "Dorothy"]);
  });

  it("falls back to splitting the legacy single payee string on '/'", () => {
    expect(getPayees({ payee: "DOREEN/DOROTHY" })).toEqual(["DOREEN", "DOROTHY"]);
  });

  it("trims whitespace around split names", () => {
    expect(getPayees({ payee: "JANE/ DAKA MRS" })).toEqual(["JANE", "DAKA MRS"]);
  });

  it("returns an empty array when neither field is present", () => {
    expect(getPayees({})).toEqual([]);
  });

  it("prefers payees array over a legacy payee string if both exist", () => {
    expect(getPayees({ payees: ["A"], payee: "B/C" })).toEqual(["A"]);
  });
});

describe("payeesLabel", () => {
  it("joins multiple names with a slash", () => {
    expect(payeesLabel({ payees: ["Doreen", "Dorothy", "Fridah"] })).toBe("Doreen / Dorothy / Fridah");
  });

  it("shows an em dash placeholder for no recipients", () => {
    expect(payeesLabel({ payees: [] })).toBe("—");
  });
});

describe("unassignedMembers", () => {
  it("returns members who appear on no row", () => {
    const rows = [["Doreen", "Dorothy"], ["Fridah"]];
    expect(unassignedMembers(rows, ["Doreen", "Dorothy", "Fridah", "Harriet"])).toEqual(["Harriet"]);
  });

  it("matches case-insensitively and ignores surrounding whitespace", () => {
    const rows = [[" doreen "]];
    expect(unassignedMembers(rows, ["DOREEN"])).toEqual([]);
  });

  it("returns every member when the schedule has no rows", () => {
    expect(unassignedMembers([], ["Doreen", "Fridah"])).toEqual(["Doreen", "Fridah"]);
  });

  it("returns an empty array when every member is assigned somewhere", () => {
    const rows = [["Doreen"], ["Fridah"]];
    expect(unassignedMembers(rows, ["Doreen", "Fridah"])).toEqual([]);
  });
});

describe("isRecipient", () => {
  const row = { payees: ["Sarah K", "Sarah N"] };

  it("matches a name exactly, case-insensitively", () => {
    expect(isRecipient(row, "sarah k", true)).toBe(true);
    expect(isRecipient(row, "Sarah K", true)).toBe(true);
  });

  it("does not match on partial/substring overlap between similar names", () => {
    // this is the bug the exact-match rewrite fixed: "Sarah" should not
    // match either "Sarah K" or "Sarah N"
    expect(isRecipient(row, "Sarah", true)).toBe(false);
  });

  it("returns false when recipientExempt is off, regardless of name match", () => {
    expect(isRecipient(row, "Sarah K", false)).toBe(false);
  });

  it("returns false for an empty or missing name", () => {
    expect(isRecipient(row, "", true)).toBe(false);
    expect(isRecipient(row, undefined, true)).toBe(false);
  });

  it("returns false for a name that isn't in the recipient list", () => {
    expect(isRecipient(row, "Harriet", true)).toBe(false);
  });
});

describe("resolveDue", () => {
  const row = { payees: ["Elizabeth"], due: 1700 };

  it("returns 0 for the recipient's own row when recipients are exempt", () => {
    expect(resolveDue(row, "Elizabeth", true, undefined)).toBe(0);
  });

  it("returns 0 for the recipient even if they have an override set (exemption wins)", () => {
    expect(resolveDue(row, "Elizabeth", true, 500)).toBe(0);
  });

  it("returns the schedule default when there's no override and no exemption applies", () => {
    expect(resolveDue(row, "Someone Else", true, undefined)).toBe(1700);
  });

  it("returns the personal override in place of the default", () => {
    expect(resolveDue(row, "Someone Else", true, 1200)).toBe(1200);
  });

  it("treats an override of 0 as a real override, not 'no override'", () => {
    expect(resolveDue(row, "Someone Else", true, 0)).toBe(0);
  });

  it("does not exempt the recipient when recipientExempt is off", () => {
    expect(resolveDue(row, "Elizabeth", false, undefined)).toBe(1700);
  });
});

describe("findNextDue", () => {
  const schedule = [
    { id: "d1", date: "2026-06-20", group: "GROUP 1", payees: ["Someone"], due: 1200 },
    { id: "d2", date: "2026-07-04", group: "GROUP 2", payees: ["Harriet"], due: 1200 },
    { id: "d3", date: "2026-07-18", group: "GROUP 3", payees: ["Someone Else"], due: 1500 },
  ];

  it("finds the earliest date with an outstanding balance", () => {
    const result = findNextDue(schedule, "Fridah", true, {}, { d1: 0, d2: 0, d3: 0 });
    expect(result.row.id).toBe("d1");
    expect(result.balance).toBe(1200);
  });

  it("skips a date that's already fully paid and moves to the next one owed", () => {
    const result = findNextDue(schedule, "Fridah", true, {}, { d1: 1200, d2: 0, d3: 0 });
    expect(result.row.id).toBe("d2");
  });

  it("skips the member's own payout date when recipients are exempt", () => {
    const result = findNextDue(schedule, "Harriet", true, {}, { d1: 0, d2: 0, d3: 0 });
    expect(result.row.id).toBe("d1");
  });

  it("returns null when every date is settled", () => {
    const result = findNextDue(schedule, "Harriet", true, {}, { d1: 1200, d2: 0, d3: 1500 });
    expect(result).toBeNull();
  });

  it("applies a due override in place of the schedule default", () => {
    const result = findNextDue(schedule, "Fridah", true, { d1: 500 }, { d1: 0, d2: 0, d3: 0 });
    expect(result.due).toBe(500);
  });

  it("returns null for an empty schedule", () => {
    expect(findNextDue([], "Fridah", true, {}, {})).toBeNull();
  });
});

describe("myNextDueDates", () => {
  // Fridah is never a payee here, so every date genuinely owes something
  // for her — Harriet's own exempt date (d2) is the one deliberately
  // testing the recipient-skip rule.
  const schedule = [
    { id: "d1", date: "2026-06-20", group: "GROUP 1", payees: ["Someone"], due: 1200 },
    { id: "d2", date: "2026-07-04", group: "GROUP 2", payees: ["Harriet"], due: 1200 },
    { id: "d3", date: "2026-07-18", group: "GROUP 3", payees: ["Someone Else"], due: 1500 },
    { id: "d4", date: "2026-08-01", group: "GROUP 4", payees: ["Yet Another"], due: 1500 },
  ];

  it("returns the next N unpaid dates in chronological order", () => {
    const result = myNextDueDates(schedule, "Fridah", true, {}, {}, 3);
    expect(result.map((r) => r.date)).toEqual(["2026-06-20", "2026-07-04", "2026-07-18"]);
    expect(result.every((r) => r.projected === false)).toBe(true);
  });

  it("skips a date the member already paid in full", () => {
    const result = myNextDueDates(schedule, "Fridah", true, {}, { d1: 1200 }, 3);
    expect(result.map((r) => r.date)).toEqual(["2026-07-04", "2026-07-18", "2026-08-01"]);
  });

  it("skips the member's own payout date when recipients are exempt", () => {
    const result = myNextDueDates(schedule, "Harriet", true, {}, {}, 4);
    expect(result.map((r) => r.date)).not.toContain("2026-07-04");
  });

  it("still counts an unpaid past date as next due, same as findNextDue", () => {
    // None of these dates are "in the future" relative to a real clock,
    // but with nothing paid they should all still show up as real
    // (non-projected) entries — asking for exactly as many as exist,
    // so nothing pads out with a projection.
    const result = myNextDueDates(schedule, "Fridah", true, {}, {}, 4);
    expect(result).toHaveLength(4);
    expect(result.every((r) => r.projected === false)).toBe(true);
  });

  it("applies a due override in place of the schedule default", () => {
    const result = myNextDueDates(schedule, "Fridah", true, { d1: 500 }, {}, 1);
    expect(result[0].due).toBe(500);
  });

  it("extrapolates beyond the real schedule using its own last interval, when fewer than count real dates remain", () => {
    const result = myNextDueDates(schedule, "Fridah", true, {}, { d1: 1200, d2: 1200, d3: 1500, d4: 1500 }, 3);
    // Real dates are all settled — every entry should be projected,
    // spaced by the schedule's own last gap (14 days: 2026-07-18 -> 2026-08-01).
    expect(result).toHaveLength(3);
    expect(result.every((r) => r.projected === true)).toBe(true);
    expect(result.map((r) => r.date)).toEqual(["2026-08-15", "2026-08-29", "2026-09-12"]);
  });

  it("carries the last known due amount forward for projected dates", () => {
    const result = myNextDueDates(schedule, "Fridah", true, {}, { d1: 1200, d2: 1200, d3: 1500, d4: 1500 }, 1);
    expect(result[0].due).toBe(1500);
  });

  it("mixes real and projected entries when only some real dates remain", () => {
    const result = myNextDueDates(schedule, "Fridah", true, {}, { d1: 1200, d2: 1200, d3: 1500 }, 3);
    expect(result[0]).toMatchObject({ date: "2026-08-01", projected: false });
    expect(result[1].projected).toBe(true);
    expect(result[2].projected).toBe(true);
  });

  it("does not extrapolate when there's only one (or zero) real schedule date to infer an interval from", () => {
    const oneRow = [{ id: "d1", date: "2026-06-20", group: "G1", payees: ["Someone"], due: 1200 }];
    expect(myNextDueDates(oneRow, "Fridah", true, {}, { d1: 1200 }, 3)).toEqual([]);
    expect(myNextDueDates([], "Fridah", true, {}, {}, 3)).toEqual([]);
  });

  it("recalculates correctly when the schedule changes (no caching)", () => {
    const before = myNextDueDates(schedule, "Fridah", true, {}, {}, 2);
    expect(before.map((r) => r.date)).toEqual(["2026-06-20", "2026-07-04"]);

    const edited = schedule.filter((r) => r.id !== "d1"); // admin removes the earliest date
    const after = myNextDueDates(edited, "Fridah", true, {}, {}, 2);
    expect(after.map((r) => r.date)).toEqual(["2026-07-04", "2026-07-18"]);
  });
});

describe("generateScheduleDates", () => {
  it("generates weekly dates 7 days apart", () => {
    const dates = generateScheduleDates("weekly", "2026-06-01", 4);
    expect(dates).toEqual(["2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22"]);
  });

  it("generates biweekly dates 14 days apart", () => {
    const dates = generateScheduleDates("biweekly", "2026-06-01", 3);
    expect(dates).toEqual(["2026-06-01", "2026-06-15", "2026-06-29"]);
  });

  it("generates monthly dates, same day-of-month each time", () => {
    const dates = generateScheduleDates("monthly", "2026-01-15", 3);
    expect(dates).toEqual(["2026-01-15", "2026-02-15", "2026-03-15"]);
  });

  it("generates bimonthly (every 2 months) dates", () => {
    const dates = generateScheduleDates("bimonthly", "2026-01-15", 3);
    expect(dates).toEqual(["2026-01-15", "2026-03-15", "2026-05-15"]);
  });

  it("handles a monthly start date that doesn't exist in every month (the 31st)", () => {
    // Jan 31 -> Feb has no 31st, JS Date rolls over to Mar 3 (2026 is not
    // a leap year, Feb has 28 days: Jan31 + 1 month = "Feb 31" = Mar 3).
    // This is a known, accepted limitation of calendar-month arithmetic,
    // not a bug — documented here so a future change to this behavior
    // is a deliberate decision, not an accidental regression.
    const dates = generateScheduleDates("monthly", "2026-01-31", 2);
    expect(dates[0]).toBe("2026-01-31");
    expect(dates[1]).toBe("2026-03-03");
  });

  it("crosses a year boundary correctly", () => {
    const dates = generateScheduleDates("monthly", "2026-12-01", 2);
    expect(dates).toEqual(["2026-12-01", "2027-01-01"]);
  });

  it("returns an empty array for a zero or negative count", () => {
    expect(generateScheduleDates("weekly", "2026-06-01", 0)).toEqual([]);
    expect(generateScheduleDates("weekly", "2026-06-01", -3)).toEqual([]);
  });

  it("returns an empty array when no start date is given", () => {
    expect(generateScheduleDates("weekly", "", 5)).toEqual([]);
    expect(generateScheduleDates("weekly", null, 5)).toEqual([]);
  });

  it("returns an empty array for an unparseable start date instead of throwing", () => {
    expect(() => generateScheduleDates("weekly", "not-a-date", 5)).not.toThrow();
    expect(generateScheduleDates("weekly", "not-a-date", 5)).toEqual([]);
  });

  it("throws for an unknown frequency", () => {
    expect(() => generateScheduleDates("daily", "2026-06-01", 3)).toThrow(/unknown frequency/i);
  });

  it("generates exactly one date when count is 1", () => {
    expect(generateScheduleDates("monthly", "2026-06-01", 1)).toEqual(["2026-06-01"]);
  });
});

describe("cycleEndDate", () => {
  it("returns the latest date regardless of row order", () => {
    const schedule = [
      { date: "2026-03-01" },
      { date: "2026-06-01" },
      { date: "2026-01-01" },
    ];
    expect(cycleEndDate(schedule)).toBe("2026-06-01");
  });

  it("returns null for an empty schedule", () => {
    expect(cycleEndDate([])).toBeNull();
    expect(cycleEndDate(undefined)).toBeNull();
  });

  it("ignores rows with an unparseable date", () => {
    const schedule = [{ date: "2026-01-01" }, { date: "" }, { date: "not-a-date" }];
    expect(cycleEndDate(schedule)).toBe("2026-01-01");
  });

  it("returns null when every row has an unparseable date", () => {
    expect(cycleEndDate([{ date: "" }, { date: "nope" }])).toBeNull();
  });
});
