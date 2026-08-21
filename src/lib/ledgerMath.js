import { resolveDue } from "./scheduleUtils.js";

/**
 * How much of a single payment entry counts toward a member's due
 * progress.
 *
 * A confirmed entry always counts the amount minus whatever was diverted
 * to the community fund at confirmation time (communityFundAmount, frozen
 * then — see worker/src/routes/admin.js). Short of that:
 *
 * - status "pending" (a member-submitted entry awaiting admin review,
 *   migration 009) or "rejected" counts ZERO — it's a real gate, not a
 *   trust flag, since nobody's verified the money arrived yet.
 * - any other unconfirmed entry (status null — every payment logged
 *   before migration 009) still counts its full amount, matching the
 *   original "an unconfirmed payment still counts fully" rule (migration
 *   004) that those entries were created under. Not retroactive.
 *
 * A voided entry never counts anything, regardless of any of the above.
 *
 * Mirrors worker/src/communityFundSplit.js's version of the same rule
 * for the server-side SUM() queries — the two must stay identical or
 * a member's own ledger and the admin's reconciliation view would
 * disagree about what "paid" means.
 *
 * @param {{amount: number, confirmedAt?: string|null, communityFundAmount?: number, voidedAt?: string|null, status?: string|null}} payment
 * @returns {number}
 */
export function effectiveContribution(payment) {
  if (payment.voidedAt) return 0;
  if (payment.confirmedAt) return payment.amount - (payment.communityFundAmount || 0);
  if (payment.status === "pending" || payment.status === "rejected") return 0;
  return payment.amount;
}

/**
 * Computes every derived figure the ledger and calculator views need,
 * from raw schedule + personal ledger data. Pure function — no React, no
 * side effects — so it can be unit tested directly (see ledgerMath.test.js)
 * without rendering a component.
 *
 * @param {object} params
 * @param {Array} params.schedule - config.schedule rows: {id, date, group, payees, due}
 * @param {object} params.ledger - { payments: [], payoutInfo: {amount, date}, dueOverrides: {} }
 * @param {string} params.sessionName - the signed-in member's display name
 * @param {boolean} params.recipientExempt - whether recipients pay K0 on their own date
 * @returns {object} totals — due, paid, balance, net, suggestedRate, remainingCount,
 *   rowsComputed (per-date breakdown), suggestedTotal
 */
export function computeLedgerTotals({ schedule, ledger, sessionName, recipientExempt }) {
  let due = 0;
  let paid = 0;
  let cumulative = 0;
  const payoutAmount = Number(ledger?.payoutInfo?.amount || 0);
  const dueOverrides = ledger?.dueOverrides || {};
  const payments = ledger?.payments || [];

  const pass1 = schedule.map((row) => {
    const overridden = dueOverrides[row.id] !== undefined;
    const rowDue = resolveDue(row, sessionName, recipientExempt, dueOverrides[row.id]);

    const entries = payments.filter((p) => p.scheduleRowId === row.id);
    const rowPaid = entries.filter((p) => !p.voidedAt).reduce((sum, p) => sum + effectiveContribution(p), 0);

    due += rowDue;
    paid += rowPaid;
    cumulative += rowPaid;

    return {
      ...row,
      due: rowDue,
      defaultDue: row.due,
      overridden,
      paid: rowPaid,
      balance: rowDue - rowPaid,
      cumulative,
      entries,
    };
  });

  const remainingCount = pass1.filter((r) => r.balance > 0).length;
  const net = payoutAmount - paid;
  const suggestedRate = remainingCount > 0 ? Math.max(net, 0) / remainingCount : 0;

  const rowsComputed = pass1.map((r) => ({
    ...r,
    suggested: r.balance > 0 ? suggestedRate : r.paid,
  }));

  return {
    due,
    paid,
    balance: due - paid,
    net,
    suggestedRate,
    remainingCount,
    rowsComputed,
    suggestedTotal: rowsComputed.reduce((sum, r) => sum + r.suggested, 0),
  };
}
