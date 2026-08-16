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
