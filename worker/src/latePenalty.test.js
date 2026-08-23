import { describe, it, expect } from "vitest";
import { isPaymentLate, computeLatePenalty } from "./latePenalty.js";

describe("isPaymentLate", () => {
  it("is not late when recorded on the due date itself, even late in the day", () => {
    expect(isPaymentLate("2026-06-20 22:45:00", "2026-06-20")).toBe(false);
  });

  it("is not late when recorded before the due date", () => {
    expect(isPaymentLate("2026-06-18 10:00:00", "2026-06-20")).toBe(false);
  });

  it("is late when recorded the day after the due date", () => {
    expect(isPaymentLate("2026-06-21 00:05:00", "2026-06-20")).toBe(true);
  });

  it("is late when recorded well after the due date", () => {
    expect(isPaymentLate("2026-07-01 09:00:00", "2026-06-20")).toBe(true);
  });

  it("handles a freeform due-date string (e.g. '20 Jun 2026'), not just ISO", () => {
    expect(isPaymentLate("2026-06-22 09:00:00", "20 Jun 2026")).toBe(true);
    expect(isPaymentLate("2026-06-19 09:00:00", "20 Jun 2026")).toBe(false);
  });

  it("returns false when either date is missing or unparseable", () => {
    expect(isPaymentLate("", "2026-06-20")).toBe(false);
    expect(isPaymentLate("2026-06-20 10:00:00", "")).toBe(false);
    expect(isPaymentLate("not a date", "2026-06-20")).toBe(false);
  });
});

describe("computeLatePenalty", () => {
  it("returns 0 when the group has no penalty configured", () => {
    expect(
      computeLatePenalty({ recordedAt: "2026-07-01", dueDate: "2026-06-20", isRecipient: false, penaltyAmount: 0 })
    ).toBe(0);
  });

  it("returns the configured amount when the payment is genuinely late", () => {
    expect(
      computeLatePenalty({ recordedAt: "2026-07-01", dueDate: "2026-06-20", isRecipient: false, penaltyAmount: 20 })
    ).toBe(20);
  });

  it("returns 0 when the payment was on time, even with a penalty configured", () => {
    expect(
      computeLatePenalty({ recordedAt: "2026-06-19", dueDate: "2026-06-20", isRecipient: false, penaltyAmount: 20 })
    ).toBe(0);
  });

  it("never penalizes the recipient's own payout-date row", () => {
    expect(
      computeLatePenalty({ recordedAt: "2026-07-01", dueDate: "2026-06-20", isRecipient: true, penaltyAmount: 20 })
    ).toBe(0);
  });

  it("treats a negative configured amount as no penalty", () => {
    expect(
      computeLatePenalty({ recordedAt: "2026-07-01", dueDate: "2026-06-20", isRecipient: false, penaltyAmount: -5 })
    ).toBe(0);
  });
});
