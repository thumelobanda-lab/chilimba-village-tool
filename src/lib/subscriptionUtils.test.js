import { describe, it, expect } from "vitest";
import { daysUntilExpiry, isExpiringSoon } from "./subscriptionUtils.js";

const NOW = new Date("2026-08-21T12:00:00Z");

describe("daysUntilExpiry", () => {
  it("returns null when there's no expiry date", () => {
    expect(daysUntilExpiry(null, NOW)).toBe(null);
    expect(daysUntilExpiry(undefined, NOW)).toBe(null);
  });

  it("rounds up so a partial day still counts as a full day remaining", () => {
    expect(daysUntilExpiry("2026-08-22T11:00:00Z", NOW)).toBe(1);
  });

  it("is negative once the expiry date is in the past", () => {
    expect(daysUntilExpiry("2026-08-01T00:00:00Z", NOW)).toBeLessThan(0);
  });

  it("is zero-or-negative exactly at the expiry instant", () => {
    expect(daysUntilExpiry("2026-08-21T12:00:00Z", NOW)).toBeLessThanOrEqual(0);
  });
});

describe("isExpiringSoon", () => {
  it("is false when there's no expiry date (free tier)", () => {
    expect(isExpiringSoon(null, NOW)).toBe(false);
  });

  it("is false when the subscription already expired", () => {
    expect(isExpiringSoon("2026-08-01T00:00:00Z", NOW)).toBe(false);
  });

  it("is false when expiry is more than the warning window away", () => {
    expect(isExpiringSoon("2026-12-01T00:00:00Z", NOW, 14)).toBe(false);
  });

  it("is true when expiry falls within the warning window", () => {
    expect(isExpiringSoon("2026-08-30T00:00:00Z", NOW, 14)).toBe(true);
  });

  it("respects a custom warning window", () => {
    expect(isExpiringSoon("2026-09-15T00:00:00Z", NOW, 30)).toBe(true);
    expect(isExpiringSoon("2026-09-15T00:00:00Z", NOW, 14)).toBe(false);
  });

  it("is true right up to the last day before expiry", () => {
    expect(isExpiringSoon("2026-08-22T00:00:00Z", NOW, 14)).toBe(true);
  });
});
