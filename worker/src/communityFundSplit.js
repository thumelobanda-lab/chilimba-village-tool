/**
 * Pure logic for splitting a confirmed payment between the community
 * fund and the member's own contribution total. Kept dependency-free
 * and colocated with a test file (same discipline as fundUtils.js) so
 * the money math is verified without touching D1.
 *
 * The split only ever happens once, at admin-confirmation time (see
 * worker/src/routes/admin.js's confirm route) — an unconfirmed payment
 * counts its full amount, matching the existing trust-flag rule from
 * migration 004.
 */

/**
 * @param {number} paymentAmount - the payment's full logged amount
 * @param {number} deductionRate - the group's community_fund_deduction
 *   at the moment of confirmation
 * @returns {{ fundAmount: number, remainder: number }}
 */
export function computeCommunityFundSplit(paymentAmount, deductionRate) {
  const amount = Number(paymentAmount) || 0;
  const rate = Number(deductionRate) || 0;
  // Capped at the payment's own amount so a payment smaller than the
  // configured deduction (e.g. a partial payment) never produces a
  // negative remainder — the whole payment goes to the fund at most.
  const fundAmount = Math.max(0, Math.min(rate, amount));
  return { fundAmount, remainder: amount - fundAmount };
}

/**
 * How much of a single payment counts toward a member's due progress. A
 * voided entry always counts zero. A confirmed entry counts its amount
 * minus whatever the community-fund split took. Otherwise: status
 * 'pending' or 'rejected' (migration 009 — a member-submitted entry
 * awaiting, or refused, admin review) counts zero; any other unconfirmed
 * entry (status NULL, logged before migration 009) still counts its full
 * amount, per the original migration-004 rule those entries were created
 * under. Mirrors src/lib/ledgerMath.js's effectiveContribution() — kept
 * as two separate small functions (worker vs. frontend) rather than a
 * shared import, since the two runtimes don't share a module boundary
 * here, but the rule itself must stay identical or the member's own
 * ledger and the admin's reconciliation view would disagree.
 *
 * @param {{amount: number, confirmedAt: string|null, communityFundAmount: number, voidedAt: string|null, status?: string|null}} payment
 * @returns {number}
 */
export function effectiveContribution(payment) {
  if (payment.voidedAt) return 0;
  if (payment.confirmedAt) return (Number(payment.amount) || 0) - (Number(payment.communityFundAmount) || 0);
  if (payment.status === "pending" || payment.status === "rejected") return 0;
  return Number(payment.amount) || 0;
}

// The reserved, always-implicit fund id for the community-fund split —
// distinct from any admin-defined named fund in groups.funds_json, since
// it's a singular concept tied to community_fund_deduction rather than
// one of the group's own named funds list.
export const COMMUNITY_FUND_ID = "community-fund";
export const COMMUNITY_FUND_NAME = "Community Fund";

/**
 * The SQL CASE expression for "how much of this payments row counts
 * toward due/paid totals" — the query-side equivalent of
 * effectiveContribution() above, for use inside SUM(...) aggregates.
 * Kept as one exported constant so every query that sums payments stays
 * consistent; it's a hardcoded string (no request data interpolated),
 * so safe to splice directly into a query.
 */
export const EFFECTIVE_CONTRIBUTION_SQL =
  "CASE" +
  " WHEN confirmed_at IS NOT NULL THEN amount - community_fund_amount" +
  " WHEN status IN ('pending', 'rejected') THEN 0" +
  " ELSE amount" +
  " END";
