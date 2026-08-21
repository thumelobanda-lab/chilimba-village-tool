import { describe, it, expect } from "vitest";
import { computeCommunityFundSplit, effectiveContribution } from "./communityFundSplit.js";

describe("computeCommunityFundSplit", () => {
  it("splits a payment larger than the deduction rate", () => {
    expect(computeCommunityFundSplit(50, 10)).toEqual({ fundAmount: 10, remainder: 40 });
  });

  it("caps the fund amount at the payment's own amount", () => {
    expect(computeCommunityFundSplit(5, 10)).toEqual({ fundAmount: 5, remainder: 0 });
  });

  it("sends the whole payment to the fund when they're equal", () => {
    expect(computeCommunityFundSplit(10, 10)).toEqual({ fundAmount: 10, remainder: 0 });
  });

  it("returns the full amount as remainder when there's no deduction configured", () => {
    expect(computeCommunityFundSplit(50, 0)).toEqual({ fundAmount: 0, remainder: 50 });
  });

  it("treats a missing/non-numeric rate as 0 instead of NaN", () => {
    expect(computeCommunityFundSplit(50, undefined)).toEqual({ fundAmount: 0, remainder: 50 });
    expect(computeCommunityFundSplit(50, "oops")).toEqual({ fundAmount: 0, remainder: 50 });
  });

  it("never produces a negative fund amount for a negative rate", () => {
    expect(computeCommunityFundSplit(50, -10)).toEqual({ fundAmount: 0, remainder: 50 });
  });
});

describe("effectiveContribution", () => {
  it("counts the full amount for an unconfirmed payment", () => {
    expect(effectiveContribution({ amount: 50, confirmedAt: null, communityFundAmount: 0 })).toBe(50);
  });

  it("counts only the remainder for a confirmed, split payment", () => {
    expect(
      effectiveContribution({ amount: 50, confirmedAt: "2026-08-20T00:00:00Z", communityFundAmount: 10 })
    ).toBe(40);
  });

  it("counts the full amount for a confirmed payment with no deduction configured", () => {
    expect(
      effectiveContribution({ amount: 50, confirmedAt: "2026-08-20T00:00:00Z", communityFundAmount: 0 })
    ).toBe(50);
  });

  it("counts 0 for a voided payment regardless of confirmation", () => {
    expect(
      effectiveContribution({
        amount: 50,
        confirmedAt: "2026-08-20T00:00:00Z",
        communityFundAmount: 10,
        voidedAt: "2026-08-21T00:00:00Z",
      })
    ).toBe(0);
  });

  it("treats a missing communityFundAmount as 0", () => {
    expect(effectiveContribution({ amount: 50, confirmedAt: "2026-08-20T00:00:00Z" })).toBe(50);
  });

  it("counts 0 for a pending (member-submitted, not yet reviewed) payment", () => {
    expect(effectiveContribution({ amount: 50, confirmedAt: null, status: "pending" })).toBe(0);
  });

  it("counts 0 for a rejected payment", () => {
    expect(effectiveContribution({ amount: 50, confirmedAt: null, status: "rejected" })).toBe(0);
  });

  it("counts the full amount once a pending payment is confirmed", () => {
    expect(
      effectiveContribution({ amount: 50, status: "pending", confirmedAt: "2026-08-20T00:00:00Z", communityFundAmount: 0 })
    ).toBe(50);
  });

  it("does not gate a legacy unconfirmed payment (status null, logged before migration 009)", () => {
    expect(effectiveContribution({ amount: 50, confirmedAt: null, status: null })).toBe(50);
  });
});
