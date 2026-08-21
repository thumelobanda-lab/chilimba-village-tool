import { isRecipient as isRecipientHelper, resolveDue } from "../scheduleUtils.js";
import { crossedDueThreshold, fundsStillToCredit } from "../fundUtils.js";
import { effectiveContribution } from "../ledgerMath.js";
import { MOCK_MODE, lsGet, lsSet, uid, realFetch, currentSession, groupScopedKey } from "./core.js";

const emptyLedger = () => ({ payments: [], payoutInfo: { amount: 0, date: "" }, dueOverrides: {} });

function uidFund() {
  return crypto.randomUUID ? crypto.randomUUID() : `f_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// Mirrors the Worker's maybeRecordFundContributions (worker/src/fundCrediting.js)
// — fires once per member per date, the moment their payments for that
// date cross from below their due amount to at or above it (see
// fundUtils.js for the shared, tested rule). Mock-mode only; the real
// crediting happens server-side, scoped to the member's group there too.
function creditFundsIfNeededMock(session, scheduleRowId, paidBefore, paidAfter) {
  const config = lsGet(groupScopedKey(session, "group"), null);
  if (!config || !config.funds?.length) return;
  const row = config.schedule.find((r) => r.id === scheduleRowId);
  if (!row) return;

  const isRecipient = isRecipientHelper(row, session.name, config.recipientExempt);
  if (isRecipient) return; // skip the ledger lookup entirely for a recipient row

  const ledgerKey = groupScopedKey(session, "ledger", session.name.toLowerCase());
  const ledger = lsGet(ledgerKey, { dueOverrides: {} });
  const due = resolveDue(row, session.name, config.recipientExempt, ledger.dueOverrides?.[scheduleRowId]);
  if (!crossedDueThreshold(paidBefore, paidAfter, due)) return;

  const feedKey = groupScopedKey(session, "fund-contributions");
  const feed = lsGet(feedKey, []);
  const already = feed
    .filter((f) => f.userKey === session.name.toLowerCase() && f.scheduleRowId === scheduleRowId)
    .map((f) => f.fundId);
  const newEntries = fundsStillToCredit(config.funds, already).map((f) => ({
    id: uidFund(),
    userKey: session.name.toLowerCase(),
    displayName: session.name,
    scheduleRowId,
    fundId: f.id,
    amount: f.amount,
    recordedAt: new Date().toISOString(),
  }));
  if (newEntries.length) lsSet(feedKey, [...feed, ...newEntries]);
}

function ledgerKeyFor(session) {
  return groupScopedKey(session, "ledger", session.name.toLowerCase());
}

// ---------- Contributions — append-only payment log ----------
// Shape: {
//   payments: [{ id, scheduleRowId, amount, note, recordedAt, recordedBy, voidedAt }],
//   payoutInfo: { amount, date },
//   dueOverrides: { [scheduleRowId]: amount }   -- see below
// }
//
// dueOverrides exist because members are NOT all charged the same amount.
// The shared schedule's "due" is a group-wide default, but different
// members can be on a different agreed contribution tier (which is also
// why payout totals differ — e.g. one member's payout is K25,700, another's
// is K17,700). Setting an override for a date replaces the schedule
// default for THIS member only; it never changes what anyone else owes.
export async function getMyLedger() {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");
  if (MOCK_MODE) {
    const l = lsGet(ledgerKeyFor(session), emptyLedger());
    return { ...emptyLedger(), ...l };
  }
  return realFetch("/api/contributions/me");
}

// Sets (or clears, with amount = null) this member's own agreed amount for
// a given date, overriding the shared schedule's default for them only.
export async function setDueOverride(scheduleRowId, amount) {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");
  if (MOCK_MODE) {
    const key = ledgerKeyFor(session);
    const l = lsGet(key, emptyLedger());
    const overrides = { ...(l.dueOverrides || {}) };
    if (amount === null || amount === "") {
      delete overrides[scheduleRowId];
    } else {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt < 0) throw new Error("Amount must be zero or a positive number.");
      overrides[scheduleRowId] = amt;
    }
    l.dueOverrides = overrides;
    lsSet(key, l);
    return { ok: true };
  }
  return realFetch("/api/contributions/due-override", {
    method: "PUT",
    body: JSON.stringify({ scheduleRowId, amount }),
  });
}

// Adds a new payment entry. Never modifies an existing one.
export async function addPayment({ scheduleRowId, amount, note = "" }) {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");
  const amt = Number(amount);
  if (!amt || amt <= 0) throw new Error("Enter an amount greater than zero.");

  const entry = {
    id: uid(),
    scheduleRowId,
    amount: amt,
    note,
    recordedAt: new Date().toISOString(),
    recordedBy: session.name,
    voidedAt: null,
    confirmedAt: null,
    confirmedBy: null,
    communityFundAmount: 0,
  };

  if (MOCK_MODE) {
    const key = ledgerKeyFor(session);
    const ledger = lsGet(key, emptyLedger());
    // Same effective-contribution rule as everywhere else a "paid" total
    // is shown — a confirmed prior payment counts only its post-split
    // remainder. This new entry is always unconfirmed at insert time, so
    // it's added below (paidBefore + amt) at its full raw amount.
    const paidBefore = ledger.payments
      .filter((p) => p.scheduleRowId === scheduleRowId && !p.voidedAt)
      .reduce((s, p) => s + effectiveContribution(p), 0);
    ledger.payments = [...ledger.payments, entry];
    lsSet(key, ledger);
    creditFundsIfNeededMock(session, scheduleRowId, paidBefore, paidBefore + amt);
    return entry;
  }
  return realFetch("/api/contributions/payments", { method: "POST", body: JSON.stringify(entry) });
}

// Marks a payment entry as voided instead of deleting it. The original
// entry stays in the record (shown struck-through in the UI) so the
// ledger never loses history — a real accounting requirement, not just
// a nicety.
export async function voidPayment(paymentId, reason = "") {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");

  if (MOCK_MODE) {
    const key = ledgerKeyFor(session);
    const ledger = lsGet(key, emptyLedger());
    ledger.payments = ledger.payments.map((p) =>
      p.id === paymentId ? { ...p, voidedAt: new Date().toISOString(), voidReason: reason } : p
    );
    lsSet(key, ledger);
    return { ok: true };
  }
  return realFetch(`/api/contributions/payments/${paymentId}/void`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// Payout received is a single recorded fact, not a running ledger — still
// worth timestamping so there's a record of when it was entered.
export async function savePayoutInfo(payoutInfo) {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");
  if (MOCK_MODE) {
    const key = ledgerKeyFor(session);
    const ledger = lsGet(key, emptyLedger());
    ledger.payoutInfo = { ...payoutInfo, recordedAt: new Date().toISOString() };
    lsSet(key, ledger);
    return { ok: true };
  }
  return realFetch("/api/contributions/payout", { method: "PUT", body: JSON.stringify(payoutInfo) });
}

export async function deleteMyData() {
  const session = currentSession();
  if (!session) return;
  if (MOCK_MODE) {
    localStorage.removeItem(ledgerKeyFor(session));
    localStorage.removeItem(groupScopedKey(session, "sub", session.name.toLowerCase()));
    return { ok: true };
  }
  return realFetch("/api/contributions/me", { method: "DELETE" });
}

// Sets the same agreed rate across every non-recipient date at once —
// used for the one-time onboarding step so a new member doesn't sit on
// the group's default rate (e.g. K1,700) by accident before they've had
// a chance to enter their own agreed amount. Individual dates can still
// be adjusted afterward with setDueOverride.
export async function setFlatRateForDates(scheduleRowIds, rate) {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");
  const amt = Number(rate);
  if (!amt || amt <= 0) throw new Error("Enter a rate greater than zero.");

  if (MOCK_MODE) {
    const key = ledgerKeyFor(session);
    const l = lsGet(key, emptyLedger());
    const overrides = { ...(l.dueOverrides || {}) };
    scheduleRowIds.forEach((id) => { overrides[id] = amt; });
    l.dueOverrides = overrides;
    lsSet(key, l);
    return { ok: true };
  }
  return realFetch("/api/contributions/due-overrides/bulk", {
    method: "POST",
    body: JSON.stringify({ scheduleRowIds, rate: amt }),
  });
}
