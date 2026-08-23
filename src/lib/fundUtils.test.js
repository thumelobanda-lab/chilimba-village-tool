import { describe, it, expect } from "vitest";
import { crossedDueThreshold, fundsStillToCredit, computeCommunityFundSplit, isPaymentLate, computeLatePenalty } from "./fundUtils.js";

describe("isPaymentLate", () => {
  it("is not late when recorded on the due date itself", () => {
    expect(isPaymentLate("2026-06-20T22:45:00.000Z", "2026-06-20")).toBe(false);
  });

  it("is late when recorded the day after the due date", () => {
    expect(isPaymentLate("2026-06-21T00:05:00.000Z", "2026-06-20")).toBe(true);
  });

  it("handles a freeform due-date string, not just ISO", () => {
    expect(isPaymentLate("2026-06-22T09:00:00.000Z", "20 Jun 2026")).toBe(true);
  });
});

describe("computeLatePenalty", () => {
  it("returns the configured amount when late", () => {
    expect(
      computeLatePenalty({ recordedAt: "2026-07-01T00:00:00.000Z", dueDate: "2026-06-20", isRecipient: false, penaltyAmount: 20 })
    ).toBe(20);
  });

  it("returns 0 when on time", () => {
    expect(
      computeLatePenalty({ recordedAt: "2026-06-19T00:00:00.000Z", dueDate: "2026-06-20", isRecipient: false, penaltyAmount: 20 })
    ).toBe(0);
  });

  it("never penalizes a recipient's own payout-date row", () => {
    expect(
      computeLatePenalty({ recordedAt: "2026-07-01T00:00:00.000Z", dueDate: "2026-06-20", isRecipient: true, penaltyAmount: 20 })
    ).toBe(0);
  });
});

describe("crossedDueThreshold", () => {
  it("returns true the moment a payment pushes cumulative paid to exactly the due amount", () => {
    expect(crossedDueThreshold(1500, 1700, 1700)).toBe(true);
  });

  it("returns true when a payment pushes cumulative paid past the due amount", () => {
    expect(crossedDueThreshold(1500, 2000, 1700)).toBe(true);
  });

  it("returns false when still below due after the payment", () => {
    expect(crossedDueThreshold(500, 1000, 1700)).toBe(false);
  });

  it("returns false if already at or above due before this payment (already credited)", () => {
    // this is what stops a second installment from re-crediting the fund
    expect(crossedDueThreshold(1700, 1900, 1700)).toBe(false);
  });

  it("returns false when due is zero (e.g. the member's own payout date)", () => {
    expect(crossedDueThreshold(0, 500, 0)).toBe(false);
  });

  it("returns false when due is negative or missing", () => {
    expect(crossedDueThreshold(0, 100, -50)).toBe(false);
    expect(crossedDueThreshold(0, 100, undefined)).toBe(false);
    expect(crossedDueThreshold(0, 100, null)).toBe(false);
  });

  it("returns false for a zero-amount payment that doesn't change the total", () => {
    expect(crossedDueThreshold(1700, 1700, 1700)).toBe(false);
  });
});

describe("fundsStillToCredit", () => {
  const funds = [
    { id: "future", name: "Future Sharing Fund", amount: 100 },
    { id: "hospital", name: "Hospital Emergency Fund", amount: 20 },
  ];

  it("returns all funds when none have been credited yet", () => {
    const result = fundsStillToCredit(funds, []);
    expect(result).toHaveLength(2);
  });

  it("excludes funds already credited", () => {
    const result = fundsStillToCredit(funds, ["future"]);
    expect(result).toEqual([{ id: "hospital", name: "Hospital Emergency Fund", amount: 20 }]);
  });

  it("returns an empty array once every fund has been credited", () => {
    const result = fundsStillToCredit(funds, ["future", "hospital"]);
    expect(result).toEqual([]);
  });

  it("is unaffected by IDs in the credited list that don't match any fund", () => {
    const result = fundsStillToCredit(funds, ["future", "some-old-removed-fund"]);
    expect(result).toEqual([{ id: "hospital", name: "Hospital Emergency Fund", amount: 20 }]);
  });
});

describe("computeCommunityFundSplit", () => {
  it("splits a payment larger than the deduction rate", () => {
    expect(computeCommunityFundSplit(50, 10)).toEqual({ fundAmount: 10, remainder: 40 });
  });

  it("caps the fund amount at the payment's own amount", () => {
    expect(computeCommunityFundSplit(5, 10)).toEqual({ fundAmount: 5, remainder: 0 });
  });

  it("returns the full amount as remainder when there's no deduction configured", () => {
    expect(computeCommunityFundSplit(50, 0)).toEqual({ fundAmount: 0, remainder: 50 });
  });

  it("treats a missing/non-numeric rate as 0 instead of NaN", () => {
    expect(computeCommunityFundSplit(50, undefined)).toEqual({ fundAmount: 0, remainder: 50 });
  });
});
