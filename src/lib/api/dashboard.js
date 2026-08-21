import { MOCK_MODE, lsGet, realFetch, currentSession, groupScopedKey } from "./core.js";

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
    const scheduleRowIds = new Set((config?.schedule || []).map((r) => r.id));
    const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const accountPrefix = `chilimba:account:${session.groupSlug}:`;
    let totalContributed = 0;
    let totalActiveMembers = 0;
    const recentPayerNames = new Set();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key.startsWith(accountPrefix)) continue;
      const name = key.slice(accountPrefix.length);
      const account = lsGet(key, {});
      if (account.active === false) continue;
      totalActiveMembers += 1;

      const ledger = lsGet(groupScopedKey(session, "ledger", name), { payments: [] });
      (ledger.payments || [])
        .filter((p) => !p.voidedAt && scheduleRowIds.has(p.scheduleRowId))
        .forEach((p) => {
          totalContributed += p.amount;
          if (new Date(p.recordedAt).getTime() >= weekAgoMs) recentPayerNames.add(name);
        });
    }

    return { totalContributed, membersPaidThisWeek: recentPayerNames.size, totalActiveMembers };
  }

  return realFetch("/api/dashboard/pulse");
}
