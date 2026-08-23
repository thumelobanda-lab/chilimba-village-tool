import React, { useState } from "react";
import { money } from "./LedgerTable.jsx";
import { getGroupFunds, getGroupPulse, getPendingPayments } from "../lib/api.js";
import { useApiData } from "../lib/useApiData.js";
import { findNextDue, myNextDueDates, payeesLabel } from "../lib/scheduleUtils.js";
import {
  computeCycleProgress,
  daysUntil,
  relativeDueLabel,
  sumFundBalances,
  buildCycleTimeline,
  findRecentPayout,
  upcomingDates,
  isMemberTurnSoon,
  isCycleNearingCompletion,
  greeting,
  myOutstandingLoanTotal,
  buildPayoutAvatarRow,
} from "../lib/dashboardMath.js";
import { useCountUp } from "../hooks/useCountUp.js";
import { computeMemberStreak } from "../lib/streakMath.js";
import ProgressRing from "./ProgressRing.jsx";
import CycleTimeline from "./CycleTimeline.jsx";
import GroupPulse from "./GroupPulse.jsx";
import PayoutAcknowledgment from "./PayoutAcknowledgment.jsx";
import UpcomingDates from "./UpcomingDates.jsx";
import MyNextPayments from "./MyNextPayments.jsx";
import QuickActions from "./QuickActions.jsx";
import PayoutAvatarRow from "./PayoutAvatarRow.jsx";
import StreakDots from "./StreakDots.jsx";

function formatDate(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  if (isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-ZM", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * The home screen — deliberately a 3-second glance, not a wall of cards.
 * Above the fold: greeting + ring, the ONE number that's actually
 * actionable (what you still owe), a compact secondary row (next due
 * date + fund total), a slim loan alert if one applies, and quick-action
 * icons. Everything else this screen used to show inline — the full
 * paid-so-far breakdown, the cycle timeline, Group Pulse, and the full
 * upcoming-dates lists — is one tap away behind "See full breakdown",
 * not gone, just no longer competing for space by default.
 */
export default function Dashboard({
  session,
  config,
  ledger,
  totals,
  onOpenReconciliation,
  onOpenLedger,
  onOpenGroupSetup,
  onOpenPaymentOptions,
  onOpenCommunity,
}) {
  const { data: fundsData, loading: fundsLoading } = useApiData(getGroupFunds, []);
  const { data: pulseData, loading: pulseLoading } = useApiData(getGroupPulse, []);
  // Admin-only — a regular member has no access to this endpoint (see
  // getPendingPayments in reconciliation.js), so this only ever fetches
  // for an admin session, same gating as the "Reconciliation" tab itself.
  const { data: pendingData } = useApiData(
    session?.role === "admin" ? getPendingPayments : () => Promise.resolve(null),
    [session?.role]
  );
  const fundTotal = fundsData ? sumFundBalances(fundsData.funds) : 0;
  const fundTotalDisplay = useCountUp(fundTotal);
  const balanceDisplay = useCountUp(totals.balance);
  const paidDisplay = useCountUp(totals.paid);
  const myLoanTotal = fundsData ? myOutstandingLoanTotal(fundsData.loans, session?.name) : 0;
  const loanTotalDisplay = useCountUp(myLoanTotal);
  // Collapsed by default — see the module doc comment above for why.
  const [expanded, setExpanded] = useState(false);

  const paidByRowId = Object.fromEntries(totals.rowsComputed.map((r) => [r.id, r.paid]));
  const nextDue = findNextDue(
    config.schedule,
    session?.name,
    config.recipientExempt,
    ledger.dueOverrides || {},
    paidByRowId
  );
  const myNextPayments = myNextDueDates(
    config.schedule,
    session?.name,
    config.recipientExempt,
    ledger.dueOverrides || {},
    paidByRowId,
    3
  );

  const cycle = computeCycleProgress(config.schedule);
  // Both derived from config.schedule, already loaded for the rest of
  // the dashboard — no extra request, so the cycle section renders in
  // the same instant as everything else here.
  const timelineRows = buildCycleTimeline(config.schedule);
  const nextUpRow = timelineRows.find((r) => r.status === "next");
  const recentPayout = findRecentPayout(config.schedule);
  const upcomingRows = upcomingDates(timelineRows);
  // Golden ring glow: only when something's actually worth highlighting —
  // the viewer's own turn is close, the cycle's in its final stretch, or
  // someone was just paid out — so it draws the eye when it lights up
  // rather than being a constant, meaningless decoration. The ring's soft
  // ambient halo (see .dashboard-hero-ring in styles.css) is always on;
  // this pulsing, brighter glow is the "something changed" signal on top
  // of that baseline.
  const ringGlow =
    isMemberTurnSoon(timelineRows, session?.name) || isCycleNearingCompletion(cycle) || Boolean(recentPayout);
  const upcomingCount = upcomingRows.length + myNextPayments.length;
  const payoutAvatarRows = buildPayoutAvatarRow(timelineRows, session?.name);
  const myStreak = computeMemberStreak(totals.rowsComputed);

  return (
    <>
      {session?.role === "admin" && pendingData && pendingData.pending.length > 0 && (
        <div
          className="pending-queue-banner"
          onClick={onOpenReconciliation}
          role={onOpenReconciliation ? "button" : undefined}
          tabIndex={onOpenReconciliation ? 0 : undefined}
        >
          <strong>{pendingData.pending.length}</strong> pending confirmation
          {pendingData.pending.length === 1 ? "" : "s"} —{" "}
          {onOpenReconciliation ? "tap to review" : "check Payment Review"}
        </div>
      )}

      {recentPayout && <PayoutAcknowledgment groupSlug={session.groupSlug} row={recentPayout} />}

      <div className="dashboard-hero">
        <div className="dashboard-hero-left">
          <div className="dashboard-hero-greeting">
            <span className="greeting-emoji">👋</span> {greeting()}, <strong>{session?.name}</strong>
            {session?.role && (
              <span className={"tag" + (session.role === "admin" ? " tag-rate" : "")} style={{ marginLeft: 8 }}>
                {session.role}
              </span>
            )}
          </div>
          <p className="dashboard-hero-sub">
            {config.groupName ? `Here's where ${config.groupName} stands today.` : "Here's where things stand today."}
          </p>
          {config.cycleName && (
            <div className="dashboard-hero-cycle">
              {config.cycleName}
              {cycle.total > 0 && ` · ${cycle.passed} of ${cycle.total} dates`}
            </div>
          )}
          {session?.role === "admin" && onOpenGroupSetup && (
            <button className="btn-link dashboard-hero-manage" onClick={onOpenGroupSetup}>
              ⚙ Manage schedule
            </button>
          )}
        </div>
        <div className="dashboard-hero-ring">
          <ProgressRing percent={cycle.percent} size={52} strokeWidth={5} glow={ringGlow} />
        </div>
      </div>

      <PayoutAvatarRow rows={payoutAvatarRows} />

      <div
        className={"vital-primary" + (onOpenLedger ? " vital-card-clickable" : "")}
        onClick={onOpenLedger}
        onKeyDown={onOpenLedger ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpenLedger()) : undefined}
        role={onOpenLedger ? "button" : undefined}
        tabIndex={onOpenLedger ? 0 : undefined}
        title={onOpenLedger ? "Go to My Payment History" : undefined}
      >
        <div className="vital-card-label">What You Still Owe</div>
        <div className={"vital-primary-value" + (totals.balance > 0 ? " vital-card-value-warn" : " vital-card-value-ok")}>
          {money(balanceDisplay)}
        </div>
      </div>

      <div className="vital-secondary-row">
        <div className="vital-secondary">
          <div className="vital-card-label">Next Payment</div>
          <div className="vital-secondary-value">
            {nextDue ? (
              <>
                {formatDate(nextDue.row.date)}
                <span className="muted tiny" style={{ display: "block", fontWeight: 400 }}>
                  {relativeDueLabel(daysUntil(nextDue.row.date))}
                </span>
              </>
            ) : (
              <span className="vital-card-value-ok">
                {config.schedule.length === 0 ? "No schedule yet" : "All caught up 🎉"}
              </span>
            )}
          </div>
        </div>
        <div className="vital-secondary">
          <div className="vital-card-label">Group Fund Total</div>
          <div className="vital-secondary-value">
            {fundsLoading ? <span className="muted small">Loading…</span> : money(fundTotalDisplay)}
          </div>
        </div>
      </div>

      {myLoanTotal > 0 && (
        <div className="loan-alert-banner">
          <span>⚠️ You owe <strong>{money(loanTotalDisplay)}</strong> on a loan from the group fund</span>
        </div>
      )}

      <QuickActions
        isAdmin={session?.role === "admin"}
        onOpenLedger={onOpenLedger}
        onOpenPaymentOptions={onOpenPaymentOptions}
        onOpenGroupSetup={onOpenGroupSetup}
        onOpenCommunity={onOpenCommunity}
      />

      <button
        type="button"
        className="dashboard-more-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded
          ? "Hide full breakdown ▲"
          : `See full breakdown${upcomingCount > 0 ? ` · ${upcomingCount} upcoming` : ""} ▾`}
      </button>

      {expanded && (
        <div className="dashboard-more-section">
          {(nextUpRow || timelineRows.length > 0) && (
            <div className="panel cycle-progress-panel">
              {nextUpRow && (
                <p className="muted small cycle-next-up">
                  Next up: <strong>{payeesLabel(nextUpRow)}</strong> — {formatDate(nextUpRow.date)}
                </p>
              )}
              <CycleTimeline rows={timelineRows} />
            </div>
          )}

          <div className="dashboard-grid">
            <div className="vital-card">
              <div className="vital-card-label">What You've Paid So Far</div>
              <div className="vital-card-value">{money(paidDisplay)}</div>
            </div>
          </div>

          <StreakDots dots={myStreak.dots} currentStreak={myStreak.currentStreak} />

          <MyNextPayments rows={myNextPayments} />

          <GroupPulse data={pulseData} loading={pulseLoading} />

          <UpcomingDates rows={upcomingRows} />
        </div>
      )}
    </>
  );
}
