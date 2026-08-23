/**
 * Pure logic for whether a confirmed payment should carry a late
 * penalty, and how much — kept dependency-free and colocated with a
 * test file, same discipline as communityFundSplit.js. Lateness is
 * judged against when the payment was actually logged (recordedAt), not
 * when an admin happens to get around to confirming it — a prompt payer
 * whose admin was slow to confirm shouldn't be penalized for the
 * admin's timing. The check runs at confirm time (worker/src/routes/
 * admin.js) because that's this app's established moment for every
 * financial effect of a payment (the community-fund split works the
 * same way), not because confirmation itself is what makes it late.
 */

// recorded_at is always SQLite's naive datetime('now') format — genuinely
// UTC, but with no "Z"/offset marker on the string itself. `new Date()`
// on that shape parses as LOCAL time, which silently shifts it by the
// runtime's UTC offset — the exact bug src/lib/serverTime.js's
// parseServerTimestamp() already exists to fix on the frontend side of
// this same problem (a Cloudflare Worker always runs in UTC so this
// never surfaces in production, but it's still wrong to rely on that,
// and it broke immediately under this module's own Node-based tests).
function recordedCalendarDay(recordedAt) {
  if (!recordedAt) return null;
  const normalized = /[zZ]|[+-]\d{2}:\d{2}$/.test(recordedAt) || recordedAt.includes("T")
    ? recordedAt
    : recordedAt.replace(" ", "T") + "Z";
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// A schedule row's date has no time component and comes in two shapes
// depending on how it was entered — bare ISO ("2026-06-20") from the
// date-generator tool, or freeform text ("20 Jun 2026") if an admin
// typed it by hand (GroupSetup.jsx's date field is plain text, not
// type="date"). A bare ISO date is read directly, no parsing needed at
// all; freeform text parses as local midnight, so it's read back with
// local getters — the same lens it was parsed through — rather than UTC
// getters, which would round to the wrong day for a non-UTC runtime.
function calendarDayOf(dateStr) {
  if (!dateStr) return null;
  const isoMatch = /^\d{4}-\d{2}-\d{2}/.exec(dateStr);
  if (isoMatch) return isoMatch[0];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * @param {string} recordedAt - the payment's own recorded_at timestamp
 * @param {string} dueDate - the schedule row's date the payment is against
 * @returns {boolean} true if recordedAt falls on a calendar day after dueDate
 */
export function isPaymentLate(recordedAt, dueDate) {
  const recordedDay = recordedCalendarDay(recordedAt);
  const dueDay = calendarDayOf(dueDate);
  if (!recordedDay || !dueDay) return false;
  return recordedDay > dueDay; // "YYYY-MM-DD" strings compare correctly lexically
}

/**
 * @param {object} params
 * @param {string} params.recordedAt
 * @param {string} params.dueDate
 * @param {boolean} params.isRecipient - a recipient's due is K0 on their
 *   own payout date (when recipientExempt) — nothing to be late against
 * @param {number} params.penaltyAmount - the group's configured late_penalty_amount
 * @returns {number} the penalty to apply, 0 if none
 */
export function computeLatePenalty({ recordedAt, dueDate, isRecipient, penaltyAmount }) {
  const amount = Number(penaltyAmount) || 0;
  if (amount <= 0 || isRecipient) return 0;
  return isPaymentLate(recordedAt, dueDate) ? amount : 0;
}
