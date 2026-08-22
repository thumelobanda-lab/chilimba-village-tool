import React from "react";
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
} from "../lib/dashboardMath.js";
import { useCountUp } from "../hooks/useCountUp.js";
import ProgressRing from "./ProgressRing.jsx";
import CycleTimeline from "./CycleTimeline.jsx";
import GroupPulse from "./GroupPulse.jsx";
import PayoutAcknowledgment from "./PayoutAcknowledgment.jsx";
import UpcomingDates from "./UpcomingDates.jsx";
import MyNextPayments from "./MyNextPayments.jsx";
import QuickActions from "./QuickActions.jsx";

function formatDate(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  if (isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-ZM", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * The home screen: exactly the "vital records" a member opens the app to
 * check — next due date, outstanding balance, the community fund total,
 * and how far through the schedule the cycle is, and who that involves.
 * Everything else (the ledger table, reminders, admin tools, ...) lives
 * behind NavMenu now, reachable but no longer competing for space on the
 * screen you land on.
 *
 * Layout is a deliberate hierarchy, richest/most personal at the top,
 * most actionable at the bottom: hero greeting + round-progress ring,
 * rotation detail, vital stat cards, group-wide pulse, what's coming up,
 * then one-tap shortcuts to the things this screen doesn't itself do
 * anything about (logging a payment, checking payment details).
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
          {config.cycleName && <div className="dashboard-hero-cycle">{config.cycleName}</div>}
          {session?.role === "admin" && onOpenGroupSetup && (
            <button className="btn-link dashboard-hero-manage" onClick={onOpenGroupSetup}>
              ⚙ Manage schedule
            </button>
          )}
        </div>
        <div className="dashboard-hero-ring">
          <ProgressRing
            percent={cycle.percent}
            size={148}
            strokeWidth={10}
            sublabel={cycle.total > 0 ? `${cycle.passed} of ${cycle.total} dates` : "No dates yet"}
            glow={ringGlow}
          />
        </div>
      </div>

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
        <div
          className={"vital-card" + (onOpenLedger ? " vital-card-clickable" : "")}
          onClick={onOpenLedger}
          onKeyDown={onOpenLedger ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpenLedger()) : undefined}
          role={onOpenLedger ? "button" : undefined}
          tabIndex={onOpenLedger ? 0 : undefined}
          title={onOpenLedger ? "Go to My Payment History" : undefined}
        >
          <div className="vital-card-label">Next Payment Due</div>
          {nextDue ? (
            <>
              <div className="vital-card-value">{formatDate(nextDue.row.date)}</div>
              <div className="muted small">
                {money(nextDue.balance)} · {relativeDueLabel(daysUntil(nextDue.row.date))}
              </div>
            </>
          ) : (
            <div className="vital-card-value vital-card-value-ok">
              {config.schedule.length === 0 ? "No schedule yet" : "All caught up 🎉"}
            </div>
          )}
        </div>

        <div className="vital-card">
          <div className="vital-card-label">What You Still Owe</div>
          <div className={"vital-card-value" + (totals.balance > 0 ? " vital-card-value-warn" : " vital-card-value-ok")}>
            {money(balanceDisplay)}
          </div>
        </div>

        <div className="vital-card">
          <div className="vital-card-label">What You've Paid So Far</div>
          <div className="vital-card-value">
            {money(paidDisplay)}
          </div>
        </div>

        <div className="vital-card">
          <div className="vital-card-label">Group Savings Fund Total</div>
          <div className="vital-card-value">
            {fundsLoading ? <span className="muted small">Loading…</span> : money(fundTotalDisplay)}
          </div>
        </div>

        {myLoanTotal > 0 && (
          <div className="vital-card vital-card-loan">
            <div className="vital-card-label">Amount You Owe (Loan)</div>
            <div className="vital-card-value vital-card-value-warn">
              {money(loanTotalDisplay)}
            </div>
          </div>
        )}
      </div>

      <MyNextPayments rows={myNextPayments} />

      <GroupPulse data={pulseData} loading={pulseLoading} />

      <UpcomingDates rows={upcomingRows} />

      <QuickActions
        isAdmin={session?.role === "admin"}
        onOpenLedger={onOpenLedger}
        onOpenPaymentOptions={onOpenPaymentOptions}
        onOpenGroupSetup={onOpenGroupSetup}
        onOpenCommunity={onOpenCommunity}
      />
    </>
  );
}
