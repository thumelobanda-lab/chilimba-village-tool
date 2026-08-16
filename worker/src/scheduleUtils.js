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
