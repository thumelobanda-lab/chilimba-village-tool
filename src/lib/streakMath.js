/**
 * Pure logic for a member's own on-time payment streak — mirrors
 * worker/src/streakMath.js's classification rules exactly (see that
 * file's comment for the full reasoning on how a row's crossing entry
 * is found and why a late-but-paid date keeps the streak alive), but
 * takes `rowsComputed` — src/lib/ledgerMath.js's computeLedgerTotals
 * output — directly, since a member's own dashboard already has that
 * (due/paid/entries per row, recipient-exemption and due-overrides
 * already resolved) without a separate API call.
 */

import { isPaymentLate } from "./fundUtils.js";

/**
 * @param {Array<object>} rowsComputed - computeLedgerTotals's rowsComputed:
 *   each row has {date, due, entries: [{amount, recordedAt, voidedAt}]}
 * @param {string} [todayISO] - "YYYY-MM-DD", defaults to today; a param so this stays testable
 * @returns {{ dots: Array<{date: string, status: 'on-time'|'late'|'missed'}>, currentStreak: number }}
 */
export function computeMemberStreak(rowsComputed, todayISO = new Date().toISOString().slice(0, 10)) {
  const today = new Date(todayISO + "T00:00:00");
  const dots = [];

  for (const row of rowsComputed || []) {
    const d = new Date(row.date + "T00:00:00");
    if (isNaN(d.getTime()) || d > today) continue; // only judge past dates
    if (!row.due || row.due <= 0) continue; // nothing owed (own exempt payout date, etc.)

    const entries = (row.entries || [])
      .filter((e) => !e.voidedAt)
      .slice()
      .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));

    let cumulative = 0;
    let crossedAt = null;
    for (const e of entries) {
      cumulative += Number(e.amount) || 0;
      if (crossedAt === null && cumulative >= row.due) crossedAt = e.recordedAt;
    }

    const status = crossedAt === null ? "missed" : isPaymentLate(crossedAt, row.date) ? "late" : "on-time";
    dots.push({ date: row.date, status });
  }

  let currentStreak = 0;
  for (let i = dots.length - 1; i >= 0; i--) {
    if (dots[i].status === "missed") break;
    currentStreak++;
  }

  return { dots, currentStreak };
}
