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
