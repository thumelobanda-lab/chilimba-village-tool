import React from "react";
import { money } from "./LedgerTable.jsx";
import { getGroupFunds, getGroupPulse } from "../lib/api.js";
import { useApiData } from "../lib/useApiData.js";
import { findNextDue, payeesLabel } from "../lib/scheduleUtils.js";
import {
  computeCycleProgress,
  daysUntil,
  relativeDueLabel,
  sumFundBalances,
  buildCycleTimeline,
  findRecentPayout,
  upcomingDates,
} from "../lib/dashboardMath.js";
import { useCountUp } from "../hooks/useCountUp.js";
import ProgressRing from "./ProgressRing.jsx";
import CycleTimeline from "./CycleTimeline.jsx";
import GroupPulse from "./GroupPulse.jsx";
import PayoutAcknowledgment from "./PayoutAcknowledgment.jsx";
import UpcomingDates from "./UpcomingDates.jsx";

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
 */
export default function Dashboard({ session, config, ledger, totals }) {
  const { data: fundsData, loading: fundsLoading } = useApiData(getGroupFunds, []);
  const { data: pulseData, loading: pulseLoading } = useApiData(getGroupPulse, []);
  const fundTotal = fundsData ? sumFundBalances(fundsData.funds) : 0;
  const fundTotalDisplay = useCountUp(fundTotal);
  const balanceDisplay = useCountUp(totals.balance);

  const paidByRowId = Object.fromEntries(totals.rowsComputed.map((r) => [r.id, r.paid]));
  const nextDue = findNextDue(
    config.schedule,
    session?.name,
    config.recipientExempt,
    ledger.dueOverrides || {},
    paidByRowId
  );

  const cycle = computeCycleProgress(config.schedule);
  // Both derived from config.schedule, already loaded for the rest of
  // the dashboard — no extra request, so the cycle section renders in
  // the same instant as everything else here.
  const timelineRows = buildCycleTimeline(config.schedule);
  const nextUpRow = timelineRows.find((r) => r.status === "next");
  const recentPayout = findRecentPayout(config.schedule);
  const upcomingRows = upcomingDates(timelineRows);

  return (
    <>
      <h2 className="panel-title">Home</h2>

      {recentPayout && <PayoutAcknowledgment groupSlug={session.groupSlug} row={recentPayout} />}

      <div className="dashboard-grid">
        <div className="vital-card">
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
          <div className="vital-card-label">Outstanding Balance</div>
          <div className={"vital-card-value" + (totals.balance > 0 ? " vital-card-value-warn" : " vital-card-value-ok")}>
            {money(balanceDisplay)}
          </div>
        </div>

        <div className="vital-card">
          <div className="vital-card-label">Community Fund Total</div>
          <div className="vital-card-value">
            {fundsLoading ? <span className="muted small">Loading…</span> : money(fundTotalDisplay)}
          </div>
        </div>
      </div>

      <div className="panel cycle-progress-panel">
        <div className="cycle-progress-header">
          <div>
            <div className="vital-card-label">Cycle Progress</div>
            {config.cycleName && <div className="panel-subtitle" style={{ margin: "2px 0 0" }}>{config.cycleName}</div>}
          </div>
          <ProgressRing
            percent={cycle.percent}
            sublabel={cycle.total > 0 ? `${cycle.passed} of ${cycle.total} dates` : "No dates yet"}
          />
        </div>

        {nextUpRow && (
          <p className="muted small cycle-next-up">
            Next up: <strong>{payeesLabel(nextUpRow)}</strong> — {formatDate(nextUpRow.date)}
          </p>
        )}

        <CycleTimeline rows={timelineRows} />
      </div>

      <UpcomingDates rows={upcomingRows} />

      <GroupPulse data={pulseData} loading={pulseLoading} />
    </>
  );
}
