import { describe, it, expect } from "vitest";
import { getPayees, payeesLabel, isRecipient, resolveDue } from "./scheduleUtils.js";

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
