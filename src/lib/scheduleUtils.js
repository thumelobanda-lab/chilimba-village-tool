// A schedule row's payout recipients — supports any number of people
// sharing a date (this group runs 1, 2, or 3 recipients per biweekly
// date, not always exactly one).
//
// Storage stays backward-compatible: rows may have either a `payees`
// array (["Doreen", "Dorothy"]) or the older single `payee` string
// ("DOREEN/DOROTHY"), which this splits on "/" as a fallback so schedules
// saved before this change keep working without a migration step.
export function getPayees(row) {
  if (Array.isArray(row.payees) && row.payees.length) {
    return row.payees.map((p) => String(p).trim()).filter(Boolean);
  }
  if (row.payee) {
    return String(row.payee).split("/").map((p) => p.trim()).filter(Boolean);
  }
  return [];
}

export function payeesLabel(row) {
  return getPayees(row).join(" / ") || "—";
}

// Is `name` one of this row's recipients? Case-insensitive, exact match
// on each name (not substring — avoids "Sarah" incorrectly matching
// "Sarah K" and "Sarah N" on the same date).
export function isRecipient(row, name, recipientExempt) {
  if (!recipientExempt || !name) return false;
  const target = name.trim().toLowerCase();
  return getPayees(row).some((p) => p.toLowerCase() === target);
}

/**
 * What a given member owes on a given date — the one formula that was
 * previously reimplemented separately in five places across the app
 * (personal totals, mock and Worker reconciliation, mock and Worker fund
 * crediting). Recipients pay nothing on their own date (if the group has
 * that policy); everyone else pays their personal override if they have
 * one, otherwise the schedule's default for that date.
 *
 * @param {object} row - a schedule row: {date, group, payees, due, ...}
 * @param {string} name - the member's display name
 * @param {boolean} recipientExempt - group policy: do recipients skip paying?
 * @param {number|null|undefined} overrideAmount - this member's personal
 *   rate override for this date, if they have one
 * @returns {number}
 */
export function resolveDue(row, name, recipientExempt, overrideAmount) {
  if (isRecipient(row, name, recipientExempt)) return 0;
  return overrideAmount !== undefined && overrideAmount !== null ? Number(overrideAmount) : row.due;
}

export function findNextDue(schedule, name, recipientExempt, dueOverridesByRowId, paidByRowId) {
  const candidates = schedule
    .map((row) => {
      const due = resolveDue(row, name, recipientExempt, dueOverridesByRowId[row.id]);
      const paid = paidByRowId[row.id] || 0;
      return { row, due, paid, balance: due - paid };
    })
    .filter((c) => c.balance > 0 && !isNaN(new Date(c.row.date).getTime()))
    .sort((a, b) => new Date(a.row.date) - new Date(b.row.date));

  return candidates[0] || null;
}

/**
 * A member's own next `count` upcoming due dates, in order — findNextDue
 * above only ever surfaces the single soonest one; this extends that
 * into a short forward-looking list ("Your next 3 expected payments")
 * so a member can plan further ahead than just the next date. Reuses
 * resolveDue's exact due-amount rules, so it always agrees with every
 * other due-amount figure elsewhere in the app (their own exempt date,
 * if recipientExempt, still correctly contributes nothing and is
 * skipped here the same way).
 *
 * Always derived fresh from the group's own explicit `schedule` — never
 * invents a date the admin hasn't actually set up, and never caches
 * anything, so it recalculates correctly the instant the schedule or
 * payout order changes. Only extrapolates PAST the last scheduled date
 * — using the gap between the schedule's own last two dates — when
 * there aren't yet `count` real dates left to show; an extrapolated
 * entry has no real row, carries the last known due amount forward as a
 * best guess (same "carry the last rate forward" convention
 * GroupSetup's date generator already uses for new rows), and is
 * flagged `projected: true` so the UI can mark it as an estimate rather
 * than a real scheduled date.
 *
 * @param {Array<object>} schedule
 * @param {string} name
 * @param {boolean} recipientExempt
 * @param {Object<string, number>} dueOverridesByRowId
 * @param {Object<string, number>} paidByRowId
 * @param {number} [count]
 * @returns {Array<{date: string, due: number|null, balance: number|null, row: object|null, projected: boolean}>}
 */
export function myNextDueDates(schedule, name, recipientExempt, dueOverridesByRowId, paidByRowId, count = 3) {
  const sorted = [...(schedule || [])]
    .filter((r) => !isNaN(new Date(r.date).getTime()))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Same "balance > 0, no date filtering" rule as findNextDue above —
  // an unpaid PAST date still counts as "next due" there (shown as
  // overdue rather than dropped), so this list stays consistent with
  // that rather than silently excluding overdue dates a member would
  // still expect to see.
  const real = sorted
    .map((row) => {
      const due = resolveDue(row, name, recipientExempt, dueOverridesByRowId?.[row.id]);
      const paid = paidByRowId?.[row.id] || 0;
      return { date: row.date, due, balance: due - paid, row, projected: false };
    })
    .filter((c) => c.balance > 0);

  const result = real.slice(0, count);
  if (result.length >= count || sorted.length < 2) return result;

  const lastTwo = sorted.slice(-2).map((r) => new Date(r.date + "T00:00:00"));
  const intervalDays = Math.round((lastTwo[1].getTime() - lastTwo[0].getTime()) / (24 * 60 * 60 * 1000));
  if (!intervalDays || intervalDays <= 0) return result;

  const lastKnownDue = sorted[sorted.length - 1].due;
  let cursor = new Date(sorted[sorted.length - 1].date + "T00:00:00");
  while (result.length < count) {
    cursor = new Date(cursor.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    result.push({
      date: cursor.toISOString().slice(0, 10),
      due: lastKnownDue ?? null,
      balance: lastKnownDue ?? null,
      row: null,
      projected: true,
    });
  }
  return result;
}

export const SCHEDULE_FREQUENCIES = {
  weekly: { label: "Weekly", days: 7 },
  biweekly: { label: "Every 2 weeks (biweekly)", days: 14 },
  monthly: { label: "Monthly", months: 1 },
  bimonthly: { label: "Every 2 months", months: 2 },
};

function toISODateString(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addInterval(date, frequency) {
  const spec = SCHEDULE_FREQUENCIES[frequency];
  if (!spec) throw new Error(`Unknown frequency: ${frequency}`);
  const d = new Date(date);
  if (spec.days) d.setDate(d.getDate() + spec.days);
  else d.setMonth(d.getMonth() + spec.months);
  return d;
}

/**
 * Generates `count` payout dates starting from `startDateISO`, spaced by
 * `frequency`. Pure — no state, no id generation, no group/due
 * assignment — GroupSetup turns these plain date strings into full
 * schedule rows. Appending "T00:00:00" (no "Z") when parsing the start
 * date deliberately keeps it in the caller's local timezone; parsing a
 * bare "YYYY-MM-DD" as UTC midnight can otherwise display as the
 * previous day in timezones behind UTC.
 *
 * @param {"weekly"|"biweekly"|"monthly"|"bimonthly"} frequency
 * @param {string} startDateISO - "YYYY-MM-DD"
 * @param {number} count
 * @returns {string[]} ISO date strings, "YYYY-MM-DD"
 */
export function generateScheduleDates(frequency, startDateISO, count) {
  if (!startDateISO || !Number.isFinite(count) || count <= 0) return [];
  const start = new Date(startDateISO + "T00:00:00");
  if (isNaN(start.getTime())) return [];

  const dates = [start];
  for (let i = 1; i < count; i++) {
    dates.push(addInterval(dates[i - 1], frequency));
  }
  return dates.map(toISODateString);
}
