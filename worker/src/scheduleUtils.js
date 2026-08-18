// See src/lib/scheduleUtils.js in the frontend for the full explanation —
// duplicated here (not imported across directories) so the Worker stays
// deployable on its own.
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

export function isRecipient(row, name, recipientExempt) {
  if (!recipientExempt || !name) return false;
  const target = name.trim().toLowerCase();
  return getPayees(row).some((p) => p.toLowerCase() === target);
}

export function resolveDue(row, name, recipientExempt, overrideAmount) {
  if (isRecipient(row, name, recipientExempt)) return 0;
  return overrideAmount !== undefined && overrideAmount !== null ? Number(overrideAmount) : row.due;
}

/**
 * The earliest schedule date a member still owes something on — what
 * the admin roster shows as "next payment". Pure: takes already-resolved
 * per-row paid totals and due overrides for ONE member, not raw DB rows,
 * so it's testable without touching D1. Dates are compared with `new
 * Date(row.date)`, same as everywhere else in this codebase — schedule
 * dates are expected in a JS-Date-parseable format (e.g. "2026-08-17").
 *
 * @param {Array} schedule - group_config's schedule rows
 * @param {string} name - the member's display name
 * @param {boolean} recipientExempt
 * @param {Object<string, number>} dueOverridesByRowId - this member's overrides
 * @param {Object<string, number>} paidByRowId - this member's non-voided paid totals per row
 * @returns {{ row: object, due: number, paid: number, balance: number } | null}
 */
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
