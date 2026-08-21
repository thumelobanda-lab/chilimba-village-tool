import { isRecipient as isRecipientHelper, resolveDue } from "../scheduleUtils.js";
import { effectiveContribution } from "../ledgerMath.js";
import { computeCommunityFundSplit } from "../fundUtils.js";
import { MOCK_MODE, lsGet, lsSet, uid, realFetch, currentSession, groupScopedKey } from "./core.js";

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

// Marks one payment entry as confirmed — a trust flag, not a gate; the
// payment already counts fully toward due/paid/balance either way.
// Mock mode needs memberName + rowId to locate the entry (there's no
// cross-account index in localStorage), which the Reconciliation screen
// already has in context since it's confirming from within one member's
// row for one date.
//
// Confirmation is also the moment the group's community-fund split (see
// fundUtils.js's computeCommunityFundSplit) applies — mirrors the
// Worker's confirm route (worker/src/routes/admin.js): the deduction
// rate in effect right now is frozen onto the payment, and if it's
// greater than 0 a matching entry is credited into the same
// "fund-contributions" feed getGroupFunds() reads. Idempotent — a
// payment that's already confirmed is left untouched rather than
// re-credited.
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
        scheduleRowId: scheduleRowId || target.scheduleRowId,
        fundId: "community-fund",
        amount: fundAmount,
        recordedAt: new Date().toISOString(),
        paymentId,
      });
      lsSet(feedKey, feed);
    }
    return { ok: true };
  }

  return realFetch(`/api/admin/payments/${paymentId}/confirm`, { method: "POST" });
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
