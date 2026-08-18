const SUBSCRIPTION_PRICE = 100; // K100
const SUBSCRIPTION_DAYS = 182; // ~6 months

export function subscriptionPrice() {
  return SUBSCRIPTION_PRICE;
}

export function subscriptionDurationDays() {
  return SUBSCRIPTION_DAYS;
}

/**
 * Is a group's subscription currently active? Pure — takes the raw
 * expires_at value (or null/undefined if never paid) and "now" so it's
 * testable without a database or a real clock.
 */
export function isSubscriptionActive(expiresAt, now = new Date()) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > now.getTime();
}

export function computeExpiryDate(from = new Date()) {
  return new Date(from.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);
}
