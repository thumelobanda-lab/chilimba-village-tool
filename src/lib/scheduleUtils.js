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
