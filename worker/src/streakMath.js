/**
 * Pure logic for a member's on-time payment streak — how many past due
 * dates in a row they've kept current, and the per-date breakdown behind
 * that count. Kept dependency-free (besides the other small pure
 * modules it composes) and colocated with a test file, same discipline
 * as latePenalty.js / communityFundSplit.js.
 *
 * A row is classified by walking its (non-voided) entries in the order
 * they were recorded and finding the exact entry that pushed the
 * cumulative total to or past the due amount — that entry's own
 * recorded_at is what isPaymentLate() checks against the due date, not
 * the row's last entry or its confirmation time. A partial payment
 * followed by a late top-up is "late"; a full on-time payment followed
 * by an unrelated later top-up (e.g. covering a due-override increase)
 * is still "on-time", since the due amount was already met on time.
 *
 * A row only counts at all if it's in the past, the member isn't its
 * exempt recipient, and it actually has something due — mirrors the
 * same rules resolveDue()/isRecipient() (scheduleUtils.js) already
 * apply everywhere else in this app, so a streak's idea of "this date
 * mattered" never disagrees with the ledger's.
 */

import { isPaymentLate } from "./latePenalty.js";
import { isRecipient as isRecipientHelper, resolveDue } from "./scheduleUtils.js";

/**
 * @param {Array<{id: string, date: string}>} schedule
 * @param {Array<{scheduleRowId: string, amount: number, recordedAt: string, voidedAt?: string|null}>} entries
 *   every one of this member's own payment entries, any schedule row, voided or not
 * @param {string} memberName
 * @param {boolean} recipientExempt
 * @param {Object<string, number>} [dueOverrides] - scheduleRowId -> this member's own agreed rate
 * @param {string} [todayISO] - "YYYY-MM-DD", defaults to today; a param so this stays testable
 * @returns {{ dots: Array<{date: string, status: 'on-time'|'late'|'missed'}>, currentStreak: number }}
 */
export function computeMemberStreak(schedule, entries, memberName, recipientExempt, dueOverrides = {}, todayISO = new Date().toISOString().slice(0, 10)) {
  const today = new Date(todayISO + "T00:00:00");
  const sorted = [...(schedule || [])].sort((a, b) => new Date(a.date) - new Date(b.date));

  const entriesByRow = {};
  for (const e of entries || []) {
    if (e.voidedAt) continue;
    (entriesByRow[e.scheduleRowId] ||= []).push(e);
  }

  const dots = [];
  for (const row of sorted) {
    const d = new Date(row.date + "T00:00:00");
    if (isNaN(d.getTime()) || d > today) continue; // only judge past dates
    if (isRecipientHelper(row, memberName, recipientExempt)) continue; // nothing owed
    const due = resolveDue(row, memberName, recipientExempt, dueOverrides[row.id]);
    if (!due || due <= 0) continue;

    const rowEntries = (entriesByRow[row.id] || [])
      .slice()
      .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));

    let cumulative = 0;
    let crossedAt = null;
    for (const e of rowEntries) {
      cumulative += Number(e.amount) || 0;
      if (crossedAt === null && cumulative >= due) crossedAt = e.recordedAt;
    }

    const status = crossedAt === null ? "missed" : isPaymentLate(crossedAt, row.date) ? "late" : "on-time";
    dots.push({ date: row.date, status });
  }

  // Counts backward from the most recent judged date — a "late" dot
  // keeps the streak alive (it still got paid, just not on time), only
  // a genuine "missed" dot breaks it.
  let currentStreak = 0;
  for (let i = dots.length - 1; i >= 0; i--) {
    if (dots[i].status === "missed") break;
    currentStreak++;
  }

  return { dots, currentStreak };
}
