import { isRecipient as isRecipientHelper, resolveDue } from "../scheduleUtils.js";
import { effectiveContribution } from "../ledgerMath.js";
import { computeCommunityFundSplit, crossedDueThreshold, fundsStillToCredit } from "../fundUtils.js";
import { MOCK_MODE, lsGet, lsSet, uid, realFetch, currentSession, groupScopedKey } from "./core.js";

// Mirrors the Worker's maybeRecordFundContributions (worker/src/fundCrediting.js)
// — fires once per member per date, the moment their payments for that
// date cross from below their due amount to at or above it (see
// fundUtils.js for the shared, tested rule). Mock-mode only; the real
// crediting happens server-side, scoped to the member's group there too.
//
// Called from confirmPayment below, tagged with paymentId so
// unconfirmPayment's existing "remove every fund-contributions entry
// tagged with this paymentId" cleanup also reverses this credit — same
// as it already does for the community-fund split's own credit.
function creditFundsIfNeededMock(session, memberName, scheduleRowId, paidBefore, paidAfter, paymentId) {
  const config = lsGet(groupScopedKey(session, "group"), null);
  if (!config || !config.funds?.length) return;
  const row = config.schedule.find((r) => r.id === scheduleRowId);
  if (!row) return;

  const isRecipient = isRecipientHelper(row, memberName, config.recipientExempt);
  if (isRecipient) return; // skip the ledger lookup entirely for a recipient row

  const ledgerKey = groupScopedKey(session, "ledger", memberName.toLowerCase());
  const ledger = lsGet(ledgerKey, { dueOverrides: {} });
  const due = resolveDue(row, memberName, config.recipientExempt, ledger.dueOverrides?.[scheduleRowId]);
  if (!crossedDueThreshold(paidBefore, paidAfter, due)) return;

  const feedKey = groupScopedKey(session, "fund-contributions");
  const feed = lsGet(feedKey, []);
  const already = feed
    .filter((f) => f.userKey === memberName.toLowerCase() && f.scheduleRowId === scheduleRowId)
    .map((f) => f.fundId);
  const newEntries = fundsStillToCredit(config.funds, already).map((f) => ({
    id: uid(),
    userKey: memberName.toLowerCase(),
    displayName: memberName,
    scheduleRowId,
    fundId: f.id,
    amount: f.amount,
    recordedAt: new Date().toISOString(),
    paymentId,
  }));
  if (newEntries.length) lsSet(feedKey, [...feed, ...newEntries]);
}

// Aggregates every member's due/paid/balance for one schedule date. The
// only place in this API that reads across members — admin-gated both
// here and (for real) server-side in the Worker, and in both cases
// scoped to the admin's own group only, never across groups.
//
// MOCK_MODE limitation: the browser's localStorage only holds data for
// accounts created in THIS browser, so this only shows something
// meaningful if you've logged in as multiple test members of the SAME
// mock group locally. It's a fine way to try the UI, but it isn't real
// cross-member data until MOCK_MODE = false and the Worker is doing the
// aggregation.
export async function getReconciliation(scheduleRowId) {
  const session = currentSession();
  if (!session || session.role !== "admin") throw new Error("Admin access required.");

  if (MOCK_MODE) {
    const config = lsGet(groupScopedKey(session, "group"), null);
    const row = config?.schedule?.find((r) => r.id === scheduleRowId);
    if (!row) throw new Error("Unknown schedule date.");

    // Only accounts within THIS admin's group — the key format is
    // chilimba:account:<groupSlug>:<name>, so the slug must match exactly.
    const accountPrefix = `chilimba:account:${session.groupSlug}:`;
    const names = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(accountPrefix)) names.add(key.slice(accountPrefix.length));
    }

    const members = [...names].map((nameKey) => {
      const ledgerKey = groupScopedKey(session, "ledger", nameKey);
      const ledger = lsGet(ledgerKey, { payments: [], dueOverrides: {} });
      const isRecipient = isRecipientHelper(row, nameKey, config?.recipientExempt);
      const due = resolveDue(row, nameKey, config?.recipientExempt, ledger.dueOverrides?.[scheduleRowId]);
      const entries = (ledger.payments || []).filter((p) => p.scheduleRowId === scheduleRowId && !p.voidedAt);
      const paid = entries.reduce((s, p) => s + effectiveContribution(p), 0);
      return {
        name: nameKey, due, paid, balance: due - paid, isRecipient,
        entries: entries.map((e) => ({ ...e, memberName: nameKey })),
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    return { row, members };
  }

  return realFetch(`/api/admin/reconciliation?rowId=${encodeURIComponent(scheduleRowId)}`);
}

// Marks one payment entry as confirmed. For a payment logged before the
// pending flow existed (status not "pending") this is still just a trust
// flag — it already counted fully toward due/paid/balance either way. For
// a "pending" payment (member-submitted, see addPayment in
// contributions.js) it's the actual gate opening: the payment goes from
// counting zero to counting fully (see effectiveContribution in
// ledgerMath.js). Mock mode needs memberName + rowId to locate the entry
// (there's no cross-account index in localStorage), which the
// Reconciliation screen already has in context since it's confirming from
// within one member's row for one date.
//
// Confirmation is also the moment the group's community-fund split (see
// fundUtils.js's computeCommunityFundSplit) applies — mirrors the
// Worker's confirm route (worker/src/routes/admin.js): the deduction
// rate in effect right now is frozen onto the payment, and if it's
// greater than 0 a matching entry is credited into the same
// "fund-contributions" feed getGroupFunds() reads. For a "pending"
// payment specifically, confirming is also the first moment it can cross
// into the group's named funds (creditFundsIfNeededMock above) — before
// the pending flow existed that crediting happened at insert time since
// every payment counted immediately, but a pending payment contributes
// nothing until now. Idempotent — a payment that's already confirmed is
// left untouched rather than re-credited.
export async function confirmPayment({ paymentId, memberName, scheduleRowId }) {
  const session = currentSession();
  if (!session || session.role !== "admin") throw new Error("Admin access required.");

  if (MOCK_MODE) {
    const ledgerKey = groupScopedKey(session, "ledger", memberName);
    const ledger = lsGet(ledgerKey, { payments: [] });
    const target = (ledger.payments || []).find((p) => p.id === paymentId);
    if (!target || target.confirmedAt) return { ok: true }; // missing or already confirmed — no-op

    const config = lsGet(groupScopedKey(session, "group"), null);
    const { fundAmount } = computeCommunityFundSplit(target.amount, config?.communityFundDeduction || 0);
    const rowId = scheduleRowId || target.scheduleRowId;

    ledger.payments = ledger.payments.map((p) =>
      p.id === paymentId
        ? { ...p, confirmedAt: new Date().toISOString(), confirmedBy: session.name, communityFundAmount: fundAmount }
        : p
    );
    lsSet(ledgerKey, ledger);

    if (fundAmount > 0) {
      const feedKey = groupScopedKey(session, "fund-contributions");
      const feed = lsGet(feedKey, []);
      feed.push({
        id: uid(),
        userKey: memberName,
        displayName: memberName,
        scheduleRowId: rowId,
        fundId: "community-fund",
        amount: fundAmount,
        recordedAt: new Date().toISOString(),
        paymentId,
      });
      lsSet(feedKey, feed);
    }

    if (target.status === "pending") {
      const paidBefore = (ledger.payments || [])
        .filter((p) => p.scheduleRowId === rowId && !p.voidedAt && p.id !== paymentId)
        .reduce((s, p) => s + effectiveContribution(p), 0);
      creditFundsIfNeededMock(session, memberName, rowId, paidBefore, paidBefore + (target.amount - fundAmount), paymentId);
    }

    return { ok: true };
  }

  return realFetch(`/api/admin/payments/${paymentId}/confirm`, { method: "POST" });
}

// Rejects a pending payment — permanently keeps it at zero (visible in
// the member's history, same append-only spirit as voiding, rather than
// disappearing) and records who rejected it and why. Only makes sense for
// a payment that hasn't been confirmed yet.
export async function rejectPayment({ paymentId, memberName, reason = "" }) {
  const session = currentSession();
  if (!session || session.role !== "admin") throw new Error("Admin access required.");

  if (MOCK_MODE) {
    const ledgerKey = groupScopedKey(session, "ledger", memberName);
    const ledger = lsGet(ledgerKey, { payments: [] });
    const target = (ledger.payments || []).find((p) => p.id === paymentId);
    if (!target) throw new Error("Payment not found.");
    if (target.confirmedAt) throw new Error("This payment is already confirmed — unconfirm it first if it needs to be rejected.");

    ledger.payments = ledger.payments.map((p) =>
      p.id === paymentId
        ? { ...p, rejectedAt: new Date().toISOString(), rejectedBy: session.name, rejectionReason: reason.slice(0, 500) }
        : p
    );
    lsSet(ledgerKey, ledger);
    return { ok: true };
  }

  return realFetch(`/api/admin/payments/${paymentId}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
}

// Every payment still awaiting admin review, across every date — the "N
// pending confirmations" queue on the roster/dashboard. Mock mode has the
// same cross-account limitation as getReconciliation above: it only sees
// accounts created in this browser.
export async function getPendingPayments() {
  const session = currentSession();
  if (!session || session.role !== "admin") throw new Error("Admin access required.");

  if (MOCK_MODE) {
    const accountPrefix = `chilimba:account:${session.groupSlug}:`;
    const names = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(accountPrefix)) names.add(key.slice(accountPrefix.length));
    }

    const pending = [];
    for (const nameKey of names) {
      const ledger = lsGet(groupScopedKey(session, "ledger", nameKey), { payments: [] });
      for (const p of ledger.payments || []) {
        if (p.status === "pending" && !p.confirmedAt && !p.rejectedAt && !p.voidedAt) {
          pending.push({
            id: p.id,
            memberName: nameKey,
            scheduleRowId: p.scheduleRowId,
            amount: p.amount,
            note: p.note,
            recordedAt: p.recordedAt,
          });
        }
      }
    }
    pending.sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
    return { pending };
  }

  return realFetch("/api/admin/payments/pending");
}

// Reverses confirmPayment's split so "confirmed" and "credited to the
// fund" stay a matching pair — resets communityFundAmount to 0 and
// removes the fund-contributions entry this specific payment created
// (matched by paymentId, not by date, since a member can log more than
// one payment against the same date).
export async function unconfirmPayment({ paymentId, memberName }) {
  const session = currentSession();
  if (!session || session.role !== "admin") throw new Error("Admin access required.");

  if (MOCK_MODE) {
    const ledgerKey = groupScopedKey(session, "ledger", memberName);
    const ledger = lsGet(ledgerKey, { payments: [] });
    ledger.payments = (ledger.payments || []).map((p) =>
      p.id === paymentId ? { ...p, confirmedAt: null, confirmedBy: null, communityFundAmount: 0 } : p
    );
    lsSet(ledgerKey, ledger);

    const feedKey = groupScopedKey(session, "fund-contributions");
    const feed = lsGet(feedKey, []);
    lsSet(feedKey, feed.filter((f) => f.paymentId !== paymentId));

    return { ok: true };
  }

  return realFetch(`/api/admin/payments/${paymentId}/unconfirm`, { method: "POST" });
}
