const SUBSCRIPTION_PRICE = 100; // K100
const SUBSCRIPTION_DAYS = 182; // ~6 months

// Every group without a CONFIRMED, unexpired subscription (see
// isSubscriptionActive) is free tier — a real, usable state, not a
// block screen: core ledger features work, capped at this many active
// members, without premium features (receipts, automated reminders,
// community-fund splitting — see communityFundSplit.js, Reminders.jsx,
// and PUT /api/schedule's own check). One constant, checked in
// joinGroup() (auth.js) so the cap is enforced where membership is
// actually granted, not just displayed in the UI.
export const FREE_TIER_MAX_MEMBERS = 8;

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
