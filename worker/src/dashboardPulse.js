/**
 * Group-wide aggregate figures for the dashboard's "Group Pulse" section
 * — deliberately AGGREGATES ONLY (one sum, two counts), never which
 * member paid what. Regular schedule contributions (unlike the always-
 * public community fund feed — see funds.js's comment) are private
 * per-member elsewhere in this app: Reconciliation is admin-only
 * specifically to gate visibility into who has or hasn't paid. This
 * must never become a second way to see that.
 *
 * Pure — no D1 access — so the route handler (routes/dashboard.js) does
 * the fetching and this just does the math, tested without a database.
 *
 * @param {Array<{amount:number, scheduleRowId:string, userId:string, recordedAt:string}>} payments
 *   every non-voided payment for the group, any schedule row
 * @param {Iterable<string>} scheduleRowIds - ids of dates in the
 *   CURRENT schedule — scopes "this cycle" to the schedule as it stands
 *   today, same as computeCycleProgress/buildCycleTimeline (dashboardMath.js)
 *   already do on the frontend
 * @param {number} activeMemberCount
 * @param {number} [nowMs] - for testability
 * @returns {{ totalContributed: number, membersPaidThisWeek: number, totalActiveMembers: number }}
 */
export function computeGroupPulse(payments, scheduleRowIds, activeMemberCount, nowMs = Date.now()) {
  const rowIds = scheduleRowIds instanceof Set ? scheduleRowIds : new Set(scheduleRowIds);
  const inCycle = (payments || []).filter((p) => rowIds.has(p.scheduleRowId));

  // Deliberately the raw amount, not effectiveContribution()'s
  // post-community-fund-split remainder (see communityFundSplit.js /
  // ledgerMath.js) — this is a "how much has moved through the group's
  // contribution system" activity figure, not a due-progress figure.
  // The community fund is still money the group collectively raised;
  // netting it out here would make Group Pulse under-report real
  // activity for no benefit, since this endpoint never breaks the total
  // down per member anyway (see the file comment above).
  const totalContributed = inCycle.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const weekAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
  const recentPayerIds = new Set(
    inCycle
      .filter((p) => new Date(p.recordedAt).getTime() >= weekAgoMs)
      .map((p) => p.userId)
  );

  return {
    totalContributed,
    membersPaidThisWeek: recentPayerIds.size,
    totalActiveMembers: activeMemberCount,
  };
}
