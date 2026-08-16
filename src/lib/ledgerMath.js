import { resolveDue } from "./scheduleUtils.js";

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
    const rowPaid = entries.filter((p) => !p.voidedAt).reduce((sum, p) => sum + p.amount, 0);

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
