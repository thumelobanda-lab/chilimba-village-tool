/**
 * Pure simple-interest projection math behind the community fund's
 * "Growth Projection" — display/planning only. Deliberately has no path
 * back into the ledger or fund-contribution APIs: nothing here writes
 * anything, and nothing in the UI that calls it does either. Simple
 * interest (not compound) — interest is calculated once, on the
 * principal only, same amount added for every equal stretch of time,
 * which is the easier-to-explain, more conservative projection for a
 * community fund that doesn't actually invest its balance anywhere.
 */

export const DEFAULT_PROJECTION_MILESTONE_MONTHS = [3, 6, 12, 24];

/**
 * Simple interest at one point in the future: I = P × r × t.
 *
 * @param {number} principal - the fund total today
 * @param {number} annualRatePercent - annual rate, as a percent (e.g. 10 for 10%)
 * @param {number} months - months from now
 * @returns {{ months: number, interest: number, projectedTotal: number }}
 */
export function simpleInterestAt(principal, annualRatePercent, months) {
  const p = Number(principal) || 0;
  const rate = (Number(annualRatePercent) || 0) / 100;
  const m = Number(months) || 0;
  const interest = p * rate * (m / 12);
  return { months: m, interest, projectedTotal: p + interest };
}

/**
 * The same projection at several future milestones, for a forward-
 * looking table rather than a single number.
 *
 * @param {number} principal
 * @param {number} annualRatePercent
 * @param {number[]} [milestoneMonths]
 * @returns {Array<{ months: number, interest: number, projectedTotal: number }>}
 */
export function buildProjectionSchedule(principal, annualRatePercent, milestoneMonths = DEFAULT_PROJECTION_MILESTONE_MONTHS) {
  return milestoneMonths.map((months) => simpleInterestAt(principal, annualRatePercent, months));
}
