// Pure date math behind the subscription-expiry warning banner — split out
// from the component so it's testable without rendering anything, same
// pattern as ledgerMath.js / dashboardMath.js.

const DEFAULT_WARNING_DAYS = 14;

/**
 * Whole days remaining until expiresAt, rounded up so "23 hours left"
 * still reads as 1 day rather than 0 — an admin renewing "the day it
 * expires" should still see it as still-active, not already-gone.
 * Negative once expiresAt is in the past.
 *
 * @param {string|null|undefined} expiresAt
 * @param {Date} [now]
 * @returns {number|null} null if there's no expiry date at all (free tier)
 */
export function daysUntilExpiry(expiresAt, now = new Date()) {
  if (!expiresAt) return null;
  const diffMs = new Date(expiresAt).getTime() - now.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Should the expiry warning banner show? Only true while the
 * subscription is still active (not yet expired — a lapsed subscription
 * is FreeTierBanner's job, not this one) and within `warningDays` of
 * running out.
 *
 * @param {string|null|undefined} expiresAt
 * @param {Date} [now]
 * @param {number} [warningDays]
 */
export function isExpiringSoon(expiresAt, now = new Date(), warningDays = DEFAULT_WARNING_DAYS) {
  const days = daysUntilExpiry(expiresAt, now);
  if (days === null) return false;
  return days > 0 && days <= warningDays;
}

export { DEFAULT_WARNING_DAYS };
