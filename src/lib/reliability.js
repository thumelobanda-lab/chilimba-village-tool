/**
 * Frontend mirror of worker/src/reliability.js's computeGRS — used by
 * MOCK_MODE (src/lib/api/dashboard.js), which has no real backend to
 * call. Takes a different input shape than the worker version: a map
 * of memberName -> rowsComputed (src/lib/ledgerMath.js's
 * computeLedgerTotals output), since that's what mock mode already has
 * per member (due/overrides already resolved), rather than raw SQL
 * rows. Composes streakMath.js's computeMemberStreak exactly the same
 * way the worker version composes its own — same weighting (on-time =
 * 100%, late = 50%, missed = 0%), same minimum sample size, so mock
 * mode never disagrees with the real backend about what a score means.
 */

import { computeMemberStreak } from "./streakMath.js";

export const MIN_GRS_SAMPLE_SIZE = 3;

/**
 * @param {Object<string, Array<object>>} rowsComputedByMember - memberName -> rowsComputed
 * @returns {{ score: number|null, sampleSize: number }}
 */
export function computeGRS(rowsComputedByMember) {
  let creditSum = 0;
  let sampleSize = 0;
  for (const name of Object.keys(rowsComputedByMember || {})) {
    const { dots } = computeMemberStreak(rowsComputedByMember[name]);
    for (const dot of dots) {
      sampleSize++;
      creditSum += dot.status === "on-time" ? 1 : dot.status === "late" ? 0.5 : 0;
    }
  }
  if (sampleSize < MIN_GRS_SAMPLE_SIZE) return { score: null, sampleSize };
  return { score: Math.round((creditSum / sampleSize) * 100), sampleSize };
}
