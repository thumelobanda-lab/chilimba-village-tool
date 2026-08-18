import { describe, it, expect } from "vitest";
import { getPayees, payeesLabel, isRecipient, resolveDue, findNextDue, generateScheduleDates } from "./scheduleUtils.js";

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
