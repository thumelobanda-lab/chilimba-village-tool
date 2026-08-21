/**
 * Pure text/data logic behind a payment receipt — separated from the
 * canvas drawing in Receipt.jsx for the same reason as inviteCard.js:
 * canvas isn't available in this project's test environment, and the
 * wording/structure is what's actually worth testing.
 *
 * Deliberately NOT a new persisted record. A receipt is a computed view
 * of an already-confirmed payment entry (id, amount, recordedAt,
 * confirmedAt, confirmedBy — all of which already exist on the payment
 * row) plus the schedule/group context around it. That means "auto-
 * generating a receipt the moment an admin confirms a payment" needs no
 * extra write at all: the receipt becomes viewable the instant
 * confirmedAt is set, and stops being viewable if an admin unconfirms it
 * again — exactly mirroring the confirm bulb's own on/off state, with no
 * separate data to drift out of sync with it.
 */

/**
 * A short, stable, shareable code for a payment — deterministically
 * derived from the payment's own id, so it never needs separate storage
 * or a counter. Not a security token (payment ids aren't secret to the
 * member or admin who already have access to the entry); it only needs
 * to be short enough to write on a receipt and consistent every time.
 *
 * @param {string} paymentId
 * @returns {string} e.g. "CHM-4F2A9C01"
 */
export function buildReferenceNumber(paymentId) {
  if (!paymentId) return "";
  const clean = String(paymentId).replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `CHM-${clean.slice(0, 8)}`;
}

/**
 * Assembles the plain-data content of a receipt from a confirmed payment
 * entry plus its surrounding context. Throws for a payment that isn't
 * confirmed — callers should only ever reach this from a confirmed entry
 * (the confirm bulb being green), so this is a defensive check, not the
 * primary gate.
 *
 * @param {object} params
 * @param {object} params.payment - {id, amount, recordedAt, confirmedAt, confirmedBy}
 * @param {string} params.memberName
 * @param {string} params.groupName
 * @param {string} [params.cycleName]
 * @param {object} [params.scheduleRow] - {date, group}
 * @returns {object} receipt data
 */
export function buildReceiptData({ payment, memberName, groupName, cycleName, scheduleRow }) {
  if (!payment) throw new Error("payment is required.");
  if (!payment.confirmedAt) throw new Error("Only a confirmed payment has a receipt.");

  const amount = Number(payment.amount) || 0;
  const communityFundAmount = Number(payment.communityFundAmount) || 0;

  return {
    memberName: memberName || "",
    amount,
    communityFundAmount,
    contributionAmount: amount - communityFundAmount,
    datePaid: payment.recordedAt || "",
    dueDate: scheduleRow?.date || "",
    dueGroup: scheduleRow?.group || "",
    cycleName: cycleName || "",
    groupName: groupName || "",
    referenceNumber: buildReferenceNumber(payment.id),
    confirmedBy: payment.confirmedBy || "",
    confirmedAt: payment.confirmedAt,
  };
}

/** WhatsApp-ready text summary of a receipt, for the same wa.me share pattern as invites. */
export function buildReceiptMessage(data) {
  const datePaid = data.datePaid ? new Date(data.datePaid).toLocaleDateString() : "—";
  const payoutLine = data.dueGroup ? `${data.dueDate} (${data.dueGroup})` : data.dueDate || "—";
  return (
    `Chilimba Circle — Payment Receipt 🧾\n\n` +
    `Group: ${data.groupName}\n` +
    (data.cycleName ? `Cycle: ${data.cycleName}\n` : "") +
    `Member: ${data.memberName}\n` +
    `Amount paid: K${data.amount.toLocaleString()}\n` +
    (data.communityFundAmount > 0
      ? `K${data.communityFundAmount.toLocaleString()} to Community Fund, K${data.contributionAmount.toLocaleString()} to contribution\n`
      : "") +
    `For payout date: ${payoutLine}\n` +
    `Date paid: ${datePaid}\n` +
    `Confirmed by: ${data.confirmedBy || "—"}\n` +
    `Reference: ${data.referenceNumber}`
  );
}

export function buildReceiptFilename(data) {
  const safe = (data.referenceNumber || "receipt").toLowerCase();
  return `chilimba-receipt-${safe}.png`;
}
