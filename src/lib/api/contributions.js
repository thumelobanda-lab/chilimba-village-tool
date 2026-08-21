import { MOCK_MODE, lsGet, lsSet, uid, realFetch, currentSession, groupScopedKey } from "./core.js";

const emptyLedger = () => ({ payments: [], payoutInfo: { amount: 0, date: "" }, dueOverrides: {} });

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

// Adds a new payment entry. Never modifies an existing one. Always
// created "pending" — the only way a payment is ever logged is the
// signed-in member self-reporting their own, so every new entry counts
// ZERO (see effectiveContribution in ledgerMath.js) and never enters a
// fund split until an admin confirms it (src/lib/api/reconciliation.js's
// confirmPayment) or rejects it (rejectPayment). Mirrors the Worker's
// POST /api/contributions/payments (migration 009).
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
    status: "pending",
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
  };

  if (MOCK_MODE) {
    const key = ledgerKeyFor(session);
    const ledger = lsGet(key, emptyLedger());
    ledger.payments = [...ledger.payments, entry];
    lsSet(key, ledger);
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
