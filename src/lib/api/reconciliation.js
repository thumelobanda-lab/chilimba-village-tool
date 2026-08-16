import { isRecipient as isRecipientHelper, resolveDue } from "../scheduleUtils.js";
import { MOCK_MODE, lsGet, realFetch, currentSession, groupScopedKey } from "./core.js";

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
      const paid = (ledger.payments || [])
        .filter((p) => p.scheduleRowId === scheduleRowId && !p.voidedAt)
        .reduce((s, p) => s + p.amount, 0);
      return { name: nameKey, due, paid, balance: due - paid, isRecipient };
    }).sort((a, b) => a.name.localeCompare(b.name));

    return { row, members };
  }

  return realFetch(`/api/admin/reconciliation?rowId=${encodeURIComponent(scheduleRowId)}`);
}
