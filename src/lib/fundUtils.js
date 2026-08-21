/**
 * The fund-crediting rule, as a pure function: a member's community-fund
 * contribution for a date is recorded exactly once, at the moment their
 * cumulative payments for that date cross from below their due amount to
 * at or above it. Extracted here so it's tested once (see
 * fundUtils.test.js) instead of trusted separately in the mock
 * implementation and the Worker.
 *
 * @param {number} paidBefore - cumulative non-voided payments for this
 *   date, before the payment being processed
 * @param {number} paidAfter - cumulative non-voided payments after it
 * @param {number} due - what this member owes for this date (0 if it's
 *   their own payout date and recipients are exempt)
 * @returns {boolean}
 */
export function crossedDueThreshold(paidBefore, paidAfter, due) {
  if (!due || due <= 0) return false;
  return paidBefore < due && paidAfter >= due;
}

/**
 * Given the group's configured funds and the fund IDs already credited
 * for this member+date, returns the funds still needing a credit. Pure —
 * the caller is responsible for actually persisting the result.
 *
 * @param {Array<{id: string}>} funds
 * @param {Iterable<string>} alreadyCreditedFundIds
 * @returns {Array}
 */
export function fundsStillToCredit(funds, alreadyCreditedFundIds) {
  const already = new Set(alreadyCreditedFundIds);
  return funds.filter((f) => !already.has(f.id));
}

// The reserved, always-implicit fund id/name for the community-fund
// split (see ledgerMath.js's effectiveContribution) — distinct from any
// admin-defined named fund, since it's a singular concept tied to a
// group's communityFundDeduction setting rather than one of the group's
// own named funds list. Mirrors worker/src/communityFundSplit.js.
export const COMMUNITY_FUND_ID = "community-fund";
export const COMMUNITY_FUND_NAME = "Community Fund";

/**
 * Splits a confirmed payment between the community fund and the
 * member's own contribution total. Mirrors
 * worker/src/communityFundSplit.js's computeCommunityFundSplit — the
 * mock-mode equivalent, used by src/lib/api/reconciliation.js's
 * confirmPayment so mock mode behaves the same as the real backend.
 *
 * @param {number} paymentAmount
 * @param {number} deductionRate
 * @returns {{ fundAmount: number, remainder: number }}
 */
export function computeCommunityFundSplit(paymentAmount, deductionRate) {
  const amount = Number(paymentAmount) || 0;
  const rate = Number(deductionRate) || 0;
  const fundAmount = Math.max(0, Math.min(rate, amount));
  return { fundAmount, remainder: amount - fundAmount };
}
