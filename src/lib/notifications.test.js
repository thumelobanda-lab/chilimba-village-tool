import { describe, it, expect } from "vitest";
import { paymentEventId, recentPaymentEvents, isReminderDue } from "./notifications.js";

const NOW = new Date("2026-08-22T12:00:00Z");

describe("paymentEventId", () => {
  it("is based on the reject decision when the payment was rejected", () => {
    const p = { id: "p1", confirmedAt: null, rejectedAt: "2026-08-20T00:00:00Z" };
    expect(paymentEventId(p)).toBe("payment-p1-2026-08-20T00:00:00Z");
  });

  it("is based on the confirm decision when the payment was confirmed", () => {
    const p = { id: "p2", confirmedAt: "2026-08-19T00:00:00Z", rejectedAt: null };
    expect(paymentEventId(p)).toBe("payment-p2-2026-08-19T00:00:00Z");
  });
});

describe("recentPaymentEvents", () => {
  const base = { id: "p1", amount: 500 };

  it("excludes a payment with no confirm or reject decision yet", () => {
    expect(recentPaymentEvents([{ ...base }], NOW)).toEqual([]);
  });

  it("excludes a voided payment even if it was confirmed", () => {
    const p = { ...base, confirmedAt: "2026-08-21T00:00:00Z", voidedAt: "2026-08-21T01:00:00Z" };
    expect(recentPaymentEvents([p], NOW)).toEqual([]);
  });

  it("includes a payment confirmed within the window", () => {
    const p = { ...base, confirmedAt: "2026-08-21T00:00:00Z" };
    expect(recentPaymentEvents([p], NOW)).toEqual([p]);
  });

  it("excludes a payment confirmed outside the window", () => {
    const p = { ...base, confirmedAt: "2026-06-01T00:00:00Z" };
    expect(recentPaymentEvents([p], NOW, 21)).toEqual([]);
  });

  it("respects a custom window", () => {
    const p = { ...base, confirmedAt: "2026-08-01T00:00:00Z" };
    expect(recentPaymentEvents([p], NOW, 7)).toEqual([]);
    expect(recentPaymentEvents([p], NOW, 30)).toEqual([p]);
  });
});

describe("isReminderDue", () => {
  it("is false when there's no due date", () => {
    expect(isReminderDue(null, NOW)).toBe(false);
  });

  it("is false when the due date is further out than the lead time", () => {
    expect(isReminderDue("2026-09-15", NOW, 3)).toBe(false);
  });

  it("is true when the due date falls within the lead time", () => {
    expect(isReminderDue("2026-08-24", NOW, 3)).toBe(true);
  });

  it("is true on the due date itself", () => {
    expect(isReminderDue("2026-08-22", NOW, 3)).toBe(true);
  });

  it("is false once the due date is already in the past", () => {
    expect(isReminderDue("2026-08-20", NOW, 3)).toBe(false);
  });
});
