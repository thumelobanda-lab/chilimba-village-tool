import { describe, it, expect } from "vitest";
import { isSubscriptionActive, computeExpiryDate, subscriptionPrice, subscriptionDurationDays } from "./subscriptionUtils.js";

describe("isSubscriptionActive", () => {
  it("is false when expiresAt is null (never paid)", () => {
    expect(isSubscriptionActive(null)).toBe(false);
  });

  it("is false when expiresAt is undefined", () => {
    expect(isSubscriptionActive(undefined)).toBe(false);
  });

  it("is true when expiresAt is in the future", () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(isSubscriptionActive(future)).toBe(true);
  });

  it("is false when expiresAt is in the past", () => {
    const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(isSubscriptionActive(past)).toBe(false);
  });

  it("respects an injected 'now' rather than always using the real clock", () => {
    const expires = new Date("2026-06-01T00:00:00Z").toISOString();
    expect(isSubscriptionActive(expires, new Date("2026-05-01T00:00:00Z"))).toBe(true);
    expect(isSubscriptionActive(expires, new Date("2026-07-01T00:00:00Z"))).toBe(false);
  });
});

describe("computeExpiryDate", () => {
  it("adds roughly 6 months (182 days) from the given date", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    const expiry = computeExpiryDate(from);
    const daysDiff = Math.round((expiry - from) / (24 * 60 * 60 * 1000));
    expect(daysDiff).toBe(182);
  });

  it("defaults to now when no date is given", () => {
    const before = Date.now();
    const expiry = computeExpiryDate();
    const after = Date.now();
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + 181 * 24 * 60 * 60 * 1000);
    expect(expiry.getTime()).toBeLessThanOrEqual(after + 183 * 24 * 60 * 60 * 1000);
  });
});

describe("pricing constants", () => {
  it("charges K100 for a group subscription", () => {
    expect(subscriptionPrice()).toBe(100);
  });

  it("subscription lasts approximately 6 months", () => {
    expect(subscriptionDurationDays()).toBe(182);
  });
});
