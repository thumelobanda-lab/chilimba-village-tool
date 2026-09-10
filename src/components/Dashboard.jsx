import React, { useState } from "react";
import { money } from "./LedgerTable.jsx";
import { getGroupFunds, getGroupPulse, getPendingPayments, getGroupMembers } from "../lib/api.js";
import { useApiData } from "../lib/useApiData.js";
import { findNextDue, myNextDueDates, payeesLabel, cycleEndDate, getPayees, unassignedMembers } from "../lib/scheduleUtils.js";
import {
  computeCycleProgress,
  currentRoundRow,
  roundProgressPercent,
  buildCycleTimeline,
  findRecentPayout,
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
import QuickActions from "./QuickActions.jsx";
import PayoutAvatarRow from "./PayoutAvatarRow.jsx";
import DashboardStatBlock from "./DashboardStatBlock.jsx";
import MyNextPaymentsTable from "./MyNextPaymentsTable.jsx";
import NoticeBoard from "./NoticeBoard.jsx";

function formatDate(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  if (isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-ZM", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * The home screen — a 3-second glance, not a wall of cards. Four focal
 * points, in order, all meant to fit one phone screen without scrolling:
 *   1. What I owe right now — the "Log a Payment" CTA, amount + date +
 *      one button, or a slim all-caught-up line when there's nothing to
 *      pay.
 *   2. What I've contributed this round — the cycle-progress ring lives
 *      HERE now, beside the figure rather than above it in its own hero
 *      block (see the ring-placement note below), with what's still
 *      owed demoted to a small sub-label underneath.
 *   3. Payout rotation — who's next and when (PayoutAvatarRow.jsx).
 *   4. One-line group snapshot (GroupPulse.jsx) — total contributed this
 *      round, members paid.
 * Below that: notices/alerts, quick actions, then "See full breakdown"
 * holds the reassuring-but-not-actionable stuff — lifetime totals,
 * streak, estimated future payments, the full cycle timeline — restated
 * as three plain tabular blocks (Your Money / Your Next Payments / The
 * Group) rather than loose stat cards.
 *
 * Ring placement: a large ring costs real vertical space, and item 1
 * above it already competes for the same "must fit on one screen"
 * budget as items 2-4. Putting the ring in its own hero block (the old
 * layout) meant paying for two stacked blocks — greeting+ring, then
 * contribution — for what's really one idea ("your progress this
 * round"). Folding the ring into the contribution card instead removes
 * an entire block's worth of height rather than just shrinking one;
 * the greeting itself moves to a plain one-line strip (no ring, no
 * gradient panel) since it no longer needs to host anything visual.
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
  onLogPayment,
}) {
  const { data: fundsData } = useApiData(getGroupFunds, []);
  const { data: pulseData, loading: pulseLoading } = useApiData(getGroupPulse, []);
  // Admin-only — a regular member has no access to this endpoint (see
  // getPendingPayments in reconciliation.js), so this only ever fetches
  // for an admin session, same gating as the "Reconciliation" tab itself.
  const { data: pendingData } = useApiData(
    session?.role === "admin" ? getPendingPayments : () => Promise.resolve(null),
    [session?.role]
  );
  // Admin-only, same gating as pendingData above — echoes GroupSetup's
  // own unassigned-members notice here too, since an admin who never
  // opens Group Setup would otherwise never see it.
  const { data: membersData } = useApiData(
    session?.role === "admin" ? getGroupMembers : () => Promise.resolve(null),
    [session?.role]
  );
  const unassigned = membersData
    ? unassignedMembers(config.schedule.map(getPayees), membersData.members.map((m) => m.name))
    : [];
  // "This round" (the ring + the figures beside it) means one specific
  // schedule row — the same row Reconciliation.jsx's Payment Review
  // defaults to — not totals.balance/totals.paid below, which are
  // summed across every row in config.schedule ever generated. See
  // currentRoundRow's doc comment for why conflating the two made the
  // ring and "contributed/remaining" disagree with each other and with
  // Payment Review.
  const roundRow = currentRoundRow(totals.rowsComputed);
  const roundPercent = roundProgressPercent(roundRow);
  const balanceDisplay = useCountUp(roundRow?.balance ?? 0);
  const paidDisplay = useCountUp(roundRow?.paid ?? 0);
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
  // Golden ring glow: only when something's actually worth highlighting —
  // the viewer's own turn is close, the cycle's in its final stretch, or
  // someone was just paid out — so it draws the eye when it lights up
  // rather than being a constant, meaningless decoration.
  const ringGlow =
    isMemberTurnSoon(timelineRows, session?.name) || isCycleNearingCompletion(cycle) || Boolean(recentPayout);
  const payoutAvatarRows = buildPayoutAvatarRow(timelineRows, session?.name);
  const myStreak = computeMemberStreak(totals.rowsComputed);

  // "Still owing" and "Paid all time" stay lifetime figures (summed
  // across every row in config.schedule, which just keeps growing —
  // this app has no cycle-archiving concept yet) — a legitimately
  // different, useful question from "Paid this round" above it, which
  // uses roundRow the same way the ring does.
  const yourMoneyRows = [
    { label: "Paid this round", value: money(roundRow?.paid ?? 0) },
    { label: "Still owing", value: money(totals.balance), warn: totals.balance > 0 },
    { label: "Paid all time", value: money(totals.paid) },
    { label: "On-time streak", value: `${myStreak.currentStreak} date${myStreak.currentStreak === 1 ? "" : "s"}` },
  ];
  const theGroupRows = [
    { label: "Contributed this round", value: pulseData ? money(pulseData.totalContributed) : "…" },
    {
      label: "Members paid this week",
      value: pulseData ? `${pulseData.membersPaidThisWeek} of ${pulseData.totalActiveMembers}` : "…",
    },
    {
      label: "Next payout",
      value: nextUpRow ? `${payeesLabel(nextUpRow)}, ${formatDate(nextUpRow.date)}` : "—",
    },
  ];

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

      {/* C — compact greeting strip: one line, no gradient panel, no ring
          (see the module doc comment above for where the ring went). */}
      <div className="dashboard-strip">
        <span className="dashboard-strip-greeting">
          👋 {greeting()}, <strong>{session?.name}</strong>
        </span>
        {session?.role && (
          <span className={"tag" + (session.role === "admin" ? " tag-rate" : "")}>{session.role}</span>
        )}
        {config.cycleName && (
          <span className="dashboard-strip-cycle muted tiny">
            {config.cycleName}
            {cycle.total > 0 && ` · ${cycle.passed} of ${cycle.total} dates`}
            {cycleEndDate(config.schedule) && ` · ends ${formatDate(cycleEndDate(config.schedule))}`}
          </span>
        )}
        {session?.role === "admin" && onOpenGroupSetup && (
          <button className="btn-link dashboard-strip-manage" onClick={onOpenGroupSetup}>
            ⚙ Manage
          </button>
        )}
      </div>

      {/* A1 — what I owe right now */}
      {nextDue ? (
        onLogPayment && (
          <button type="button" className="log-payment-cta" onClick={onLogPayment}>
            <span className="log-payment-cta-icon" aria-hidden="true">💸</span>
            <span className="log-payment-cta-text">
              <span className="log-payment-cta-title">You Owe {money(nextDue.balance)}</span>
              <span className="log-payment-cta-sub">Due {formatDate(nextDue.row.date)}</span>
            </span>
            <span className="log-payment-cta-arrow" aria-hidden="true">›</span>
          </button>
        )
      ) : (
        <div className="owed-now-clear">✓ Nothing owed right now</div>
      )}

      {/* A2 — what I've contributed this round, ring alongside the figure */}
      <div
        className={"vital-primary vital-primary-with-ring" + (onOpenLedger ? " vital-card-clickable" : "")}
        onClick={onOpenLedger}
        onKeyDown={onOpenLedger ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpenLedger()) : undefined}
        role={onOpenLedger ? "button" : undefined}
        tabIndex={onOpenLedger ? 0 : undefined}
        title={onOpenLedger ? "Go to My Payment History" : undefined}
      >
        <div className="vital-ring-labeled">
          <ProgressRing percent={roundPercent} size={78} strokeWidth={7} glow={ringGlow} arcColor="var(--accent-2)" filled />
          <span className="vital-ring-caption">Cycle progress</span>
        </div>
        <div className="vital-primary-body">
          <div className="vital-card-label">This Round</div>
          <div className="vital-primary-value vital-card-value-ok">
            {money(paidDisplay)} <span className="vital-primary-value-suffix">contributed 🎉</span>
          </div>
          <div className={"vital-primary-sub" + ((roundRow?.balance ?? 0) > 0 ? " vital-card-value-warn" : " vital-card-value-ok")}>
            {(roundRow?.balance ?? 0) > 0 ? `${money(balanceDisplay)} remaining` : "All caught up 🎉"}
          </div>
        </div>
      </div>

      {/* A3 — who's next in the payout rotation */}
      <PayoutAvatarRow rows={payoutAvatarRows} />

      {/* A4 — one-line group snapshot */}
      <GroupPulse data={pulseData} loading={pulseLoading} />

      <NoticeBoard isAdmin={session?.role === "admin"} />

      {session?.role === "admin" && unassigned.length > 0 && (
        <p className="inline-alert">
          ⚠️ <strong>{unassigned.length}</strong> member{unassigned.length === 1 ? "" : "s"} not on the payout
          schedule —{" "}
          {onOpenGroupSetup ? (
            <button type="button" className="inline-alert-link" onClick={onOpenGroupSetup}>
              add them in Group Setup
            </button>
          ) : (
            "add them in Group Setup"
          )}
        </p>
      )}

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
        {expanded ? "Hide full breakdown ▲" : "See full breakdown ▾"}
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

          <DashboardStatBlock title="Your Money" rows={yourMoneyRows} />
          <MyNextPaymentsTable rows={myNextPayments} />
          <DashboardStatBlock title="The Group" rows={theGroupRows} />
        </div>
      )}
    </>
  );
}
