import { MOCK_MODE, lsGet, realFetch, currentSession, groupScopedKey } from "./core.js";
import { computeLedgerTotals } from "../ledgerMath.js";
import { computeGRS } from "../reliability.js";

// Group-wide aggregate figures for the home dashboard's "Group Pulse"
// section — deliberately aggregates only (a sum, two counts), never
// which member paid what. See computeGroupPulse in the Worker
// (worker/src/dashboardPulse.js) for the full reasoning: the regular
// schedule-contribution ledger is private per-member elsewhere in this
// app (Reconciliation is admin-only specifically to gate that), and
// this must not become a second way to see who has or hasn't paid.
export async function getGroupPulse() {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");

  if (MOCK_MODE) {
    const config = lsGet(groupScopedKey(session, "group"), null);
    const schedule = config?.schedule || [];
    const recipientExempt = !!config?.recipientExempt;
    const scheduleRowIds = new Set(schedule.map((r) => r.id));
    const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const accountPrefix = `chilimba:account:${session.groupSlug}:`;
    let totalContributed = 0;
    let totalActiveMembers = 0;
    const recentPayerNames = new Set();
    const rowsComputedByMember = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key.startsWith(accountPrefix)) continue;
      const name = key.slice(accountPrefix.length);
      const account = lsGet(key, {});
      if (account.active === false) continue;
      totalActiveMembers += 1;

      const ledger = lsGet(groupScopedKey(session, "ledger", name), { payments: [], payoutInfo: { amount: 0 }, dueOverrides: {} });
      (ledger.payments || [])
        .filter((p) => !p.voidedAt && scheduleRowIds.has(p.scheduleRowId))
        .forEach((p) => {
          totalContributed += p.amount;
          if (new Date(p.recordedAt).getTime() >= weekAgoMs) recentPayerNames.add(name);
        });

      const totals = computeLedgerTotals({ schedule, ledger, sessionName: name, recipientExempt });
      rowsComputedByMember[name] = totals.rowsComputed;
    }

    // Note: unlike the real Worker endpoint (which deliberately skips
    // per-member due overrides to keep its query simple — see
    // worker/src/routes/dashboard.js), this mock version gets them for
    // free since computeLedgerTotals already applies each member's own
    // ledger.dueOverrides. A minor, harmless mock/real discrepancy —
    // due overrides are a rare edge case either way.
    const grs = computeGRS(rowsComputedByMember);

    return { totalContributed, membersPaidThisWeek: recentPayerNames.size, totalActiveMembers, grs };
  }

  return realFetch("/api/dashboard/pulse");
}
