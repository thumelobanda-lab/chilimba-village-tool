import React, { useEffect, useState } from "react";
import { money } from "./LedgerTable.jsx";
import { getGroupFunds, getGroupPulse, getPendingPayments, getGroupMembers, getGroupRoster } from "../lib/api.js";
import { useApiData } from "../lib/useApiData.js";
import { findNextDue, myNextDueDates, payeesLabel, cycleEndDate, getPayees, unassignedMembers } from "../lib/scheduleUtils.js";
import {
  computeCycleProgress,
  bannerCycleLine,
  currentRoundRow,
  roundProgressPercent,
  buildCycleTimeline,
  findRecentPayout,
  myOutstandingLoanTotal,
  buildPayoutAvatarRow,
  membersMissingMomo,
  capitalizeName,
} from "../lib/dashboardMath.js";
import { useCountUp } from "../hooks/useCountUp.js";
import { computeMemberStreak } from "../lib/streakMath.js";
import { resolveMilestoneEvent } from "../lib/milestones.js";
import CycleTimeline from "./CycleTimeline.jsx";
import PayoutAcknowledgment from "./PayoutAcknowledgment.jsx";
import MilestoneMoment from "./MilestoneMoment.jsx";
import PayoutTimeline from "./PayoutTimeline.jsx";
import DashboardStatBlock from "./DashboardStatBlock.jsx";
import MyNextPaymentsTable from "./MyNextPaymentsTable.jsx";
import NoticeBoard from "./NoticeBoard.jsx";
import Icon from "./Icon.jsx";
import { withViewTransition } from "../lib/viewTransition.js";

function formatDate(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  if (isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-ZM", { weekday: "short", day: "numeric", month: "short" });
}

function formatToday() {
  return new Date().toLocaleDateString("en-ZM", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * The home screen — a calm-ledger read, not a wall of cards (see
 * styles.css's .dashboard-ledger block for the warm-paper/serif-numerals
 * design tokens this pass introduced). In order:
 *   1. Status block — one sentence answering "where do I stand" (owed or
 *      caught up, from the same findNextDue logic as before), a sub-line
 *      with the next contribution due, and the one primary action
 *      ("Log a payment"). Replaces the old CTA + separate progress ring
 *      + "contributed"/"caught up" chips, which all restated pieces of
 *      this same question — consolidated into one block.
 *   2. This round — collected vs. target, members paid, as plain ruled
 *      rows with a thin progress bar instead of a boxed card with a
 *      circular ring.
 *   3. Who receives (PayoutTimeline.jsx) — the payout rotation as a
 *      vertical timeline instead of a horizontal avatar strip; same
 *      underlying rotation data and interactions (tap to preview,
 *      long-press to remind), just displayed differently.
 *   4. More — Payment options / Roster & admins / Full breakdown as
 *      plain list rows instead of boxed quick-action buttons; each
 *      still calls the exact same handler as before. ("Community fund"
 *      was removed from here — it's the exact same Community.jsx screen
 *      as the bottom-nav "Community" tab, so the shortcut was a pure
 *      duplicate.)
 * Notices/alerts (pending confirmations, the milestone moment, payout
 * acknowledgment, unassigned members, missing mobile-money numbers, an
 * outstanding loan) keep their own existing look and slot in around
 * these sections unchanged — this pass restructures the core dashboard,
 * not every alert banner's own styling.
 *
 * The group name/switcher and member avatar this screen used to repeat
 * in its own cover banner now live only in the app header (App.jsx),
 * on every tab — see the group-name-duplication fix earlier in this
 * project's history; nothing here repeats that again.
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
  onLogPayment,
  onSendReminder,
}) {
  const { data: fundsData } = useApiData(getGroupFunds, []);
  const { data: pulseData } = useApiData(getGroupPulse, []);
  // Every signed-in member can see this (unlike getGroupMembers below,
  // admin-only) — just name + hasPhoto/photoDataUrl, enough to put real
  // photos on the rotation timeline instead of initials-only circles.
  const { data: rosterData } = useApiData(getGroupRoster, []);
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
  const isAdmin = session?.role === "admin";
  const unassigned = membersData
    ? unassignedMembers(config.schedule.map(getPayees), membersData.members.map((m) => m.name))
    : [];
  // "This round" means one specific schedule row — the same row
  // Reconciliation.jsx's Payment Review defaults to — not
  // totals.balance/totals.paid below, which are summed across every row
  // in config.schedule ever generated. See currentRoundRow's doc comment
  // for why conflating the two made this section and Payment Review
  // disagree with each other.
  const roundRow = currentRoundRow(totals.rowsComputed);
  const roundPercent = roundProgressPercent(roundRow);
  const balanceDisplay = useCountUp(roundRow?.balance ?? 0);
  const paidDisplay = useCountUp(roundRow?.paid ?? 0);
  const myLoanTotal = fundsData ? myOutstandingLoanTotal(fundsData.loans, session?.name) : 0;
  const loanTotalDisplay = useCountUp(myLoanTotal);
  // Collapsed by default — "Full breakdown" in the More list toggles it.
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
  // The status block's sub-line: the amount/date actually owed right
  // now if there is one, otherwise the next scheduled contribution even
  // though nothing's due yet — same two data sources (findNextDue /
  // myNextDueDates) the old CTA and "Your Next Payments" table already
  // used, just read together here for one always-present line.
  const nextContribution = nextDue
    ? { amount: nextDue.balance, date: nextDue.row.date }
    : myNextPayments[0]
    ? { amount: myNextPayments[0].due, date: myNextPayments[0].date }
    : null;
  const firstName = capitalizeName((session?.name || "").trim().split(/\s+/)[0] || "");
  const statusLine = nextDue
    ? `You owe ${money(nextDue.balance)}${firstName ? `, ${firstName}` : ""}.`
    : `You're all paid up${firstName ? `, ${firstName}` : ""}.`;

  const cycle = computeCycleProgress(config.schedule);
  // "This round" section's small caption — same cycle-progress data as
  // the rest of this file, formatted once here.
  const cycleEnd = cycleEndDate(config.schedule);
  const cycleLine = bannerCycleLine({
    cycleName: config.cycleName,
    cycleTotal: cycle.total,
    cyclePassed: cycle.passed,
    formattedEndDate: cycleEnd ? formatDate(cycleEnd) : null,
  });
  // Both derived from config.schedule, already loaded for the rest of
  // the dashboard — no extra request, so this section renders in the
  // same instant as everything else here.
  const timelineRows = buildCycleTimeline(config.schedule);
  const nextUpRow = timelineRows.find((r) => r.status === "next");
  const recentPayout = findRecentPayout(config.schedule);
  // The richer, once-per-event milestone moment (MilestoneMoment.jsx) —
  // a separate signal from recentPayout above even though both come
  // from the same underlying data, since this one also needs to know
  // whether the payout completed the whole cycle.
  const milestoneEvent = resolveMilestoneEvent(config.schedule);
  // Admin-only heads-up, same gating/data source as `unassigned` above —
  // surfaced during the countdown to the next payout, not discovered
  // only once the group actually tries to pay someone.
  const missingMomo =
    isAdmin && membersData && nextUpRow ? membersMissingMomo(getPayees(nextUpRow), membersData.members) : [];
  const photoByName = new Map(
    (rosterData?.members || []).map((m) => [m.name.trim().toLowerCase(), m])
  );
  const payoutTimelineRows = buildPayoutAvatarRow(timelineRows, session?.name, {
    rowsComputed: totals.rowsComputed,
  }).map((r) => {
    const match = photoByName.get(r.name.trim().toLowerCase());
    return { ...r, hasPhoto: match?.hasPhoto || false, photoDataUrl: match?.photoDataUrl || null };
  });
  const myStreak = computeMemberStreak(totals.rowsComputed);

  // Cycle-completion trigger for the timeline's pop/highlight animation:
  // fires once, the moment this round's balance reads 0 (i.e.
  // buildPayoutAvatarRow's rowsComputed option already promoted it to
  // "received" above), by comparing against the last round id this
  // browser recorded as animated. Deliberately localStorage, not React
  // state alone — the confirming action usually happens on the
  // Reconciliation tab, a different mount of this component entirely, so
  // there's no in-memory "previous roundRow" to diff against; persisting
  // the last-seen id is what makes this survive the tab switch. Scoped
  // per-group, not per-member: this celebrates a group-level event (the
  // round is fully collected), not a personal one, so whichever member
  // happens to open the dashboard first after confirmation is the one
  // who sees it play.
  const [animateTransition, setAnimateTransition] = useState(null);
  useEffect(() => {
    if (!session?.groupSlug || !roundRow || roundRow.due <= 0 || roundRow.balance > 0) return;
    const key = `chilimba:lastAnimatedRound:${session.groupSlug}`;
    const lastId = localStorage.getItem(key);
    if (lastId === String(roundRow.id)) return;
    const isFirstEverCheck = lastId === null;
    localStorage.setItem(key, String(roundRow.id));
    // A brand-new browser/device that's never recorded anything yet would
    // otherwise "animate" every already-completed historical round on its
    // very first load — only play it once there's something to actually
    // compare against.
    if (isFirstEverCheck) return;
    const completedNames = payoutTimelineRows.filter((r) => r.date === roundRow.date).map((r) => r.name);
    const nextNames = payoutTimelineRows.filter((r) => r.status === "next").map((r) => r.name);
    if (completedNames.length === 0) return;
    // Layers a native View Transitions crossfade (browser support/
    // reduced-motion permitting — see lib/viewTransition.js) underneath
    // the timeline's own CSS pop/connector animation above, rather than
    // replacing it: this call is what actually flips rows from "paid" to
    // "next-up", the CSS classes are what animate the result.
    withViewTransition(() => setAnimateTransition({ completedNames, nextNames }));
    // Safety-net clear in case the connector's onAnimationEnd never fires
    // (e.g. the two rows aren't adjacent in the list, so no connector is
    // even rendered) — the localStorage marker above already prevents a
    // replay regardless, this just tidies up the transient pop classes.
    const t = setTimeout(() => setAnimateTransition(null), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.groupSlug, roundRow?.id, roundRow?.balance]);

  // "Still owing" and "Paid all time" stay lifetime figures (summed
  // across every row in config.schedule, which just keeps growing —
  // this app has no cycle-archiving concept yet) — a legitimately
  // different, useful question from "Collected" in This Round above,
  // which uses roundRow the same way the progress bar does.
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
  ];

  return (
    <div className="dashboard-ledger">
      {isAdmin && pendingData && pendingData.pending.length > 0 && (
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

      {milestoneEvent && <MilestoneMoment groupSlug={session.groupSlug} event={milestoneEvent} />}

      {recentPayout && <PayoutAcknowledgment groupSlug={session.groupSlug} row={recentPayout} />}

      {/* 1 — status block: where do I stand, one sentence, one action */}
      <div className="ledger-status-block">
        <div className="ledger-status-date">{formatToday()}</div>
        <p className="ledger-status-line">{statusLine}</p>
        {nextContribution && (
          <p className="ledger-status-sub">
            Next: {money(nextContribution.amount)} due {formatDate(nextContribution.date)}
          </p>
        )}
        {onLogPayment && (
          <button type="button" className="ledger-primary-btn" onClick={onLogPayment} data-tour="log-payment-cta">
            Log a payment
          </button>
        )}
      </div>

      {/* 2 — this round: collected vs target, thin progress bar. Still
          opens My Payment History on tap/Enter, same shortcut the old
          ring card offered — only the visual changed. */}
      <div
        className={"ledger-section" + (onOpenLedger ? " ledger-section-clickable" : "")}
        onClick={onOpenLedger}
        onKeyDown={onOpenLedger ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpenLedger()) : undefined}
        role={onOpenLedger ? "button" : undefined}
        tabIndex={onOpenLedger ? 0 : undefined}
        title={onOpenLedger ? "Go to My Payment History" : undefined}
        data-tour="cycle-progress-ring"
      >
        <div className="ledger-section-heading">
          <span className="ledger-section-label">This round</span>
          {cycleLine && <span className="ledger-section-caption">{cycleLine}</span>}
        </div>
        <div className="ledger-row">
          <span className="ledger-row-label">Collected</span>
          <span className="ledger-row-value">{money(paidDisplay)}</span>
        </div>
        <div className="ledger-row">
          <span className="ledger-row-label">Target</span>
          <span className="ledger-row-value">{money(roundRow?.due ?? 0)}</span>
        </div>
        <div
          className="ledger-progress-track"
          role="progressbar"
          aria-label="Round progress"
          aria-valuenow={Math.round(roundPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="ledger-progress-fill" style={{ width: `${roundPercent}%` }} />
        </div>
        <div className="ledger-row ledger-row-muted">
          <span className="ledger-row-label">
            {(roundRow?.balance ?? 0) > 0 ? `${money(balanceDisplay)} still owed this round` : "All caught up this round"}
          </span>
          <span className="ledger-row-value">
            {pulseData ? `${pulseData.membersPaidThisWeek} of ${pulseData.totalActiveMembers} paid` : "…"}
          </span>
        </div>
      </div>

      {/* 3 — who receives: vertical rotation timeline */}
      <PayoutTimeline
        rows={payoutTimelineRows}
        animateTransition={animateTransition}
        onAnimationDone={() => setAnimateTransition(null)}
        onSendReminder={isAdmin ? onSendReminder : undefined}
      />

      <NoticeBoard isAdmin={isAdmin} />

      {isAdmin && unassigned.length > 0 && (
        <p className="inline-alert">
          <Icon name="warning" size={14} className="icon-inline" /> <strong>{unassigned.length}</strong> member{unassigned.length === 1 ? "" : "s"} not on the payout
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

      {isAdmin && missingMomo.length > 0 && (
        <p className="inline-alert">
          <Icon name="warning" size={14} className="icon-inline" /> <strong>{missingMomo.join(", ")}</strong>{" "}
          {missingMomo.length === 1 ? "hasn't" : "haven't"} set a mobile money payout number yet, and{" "}
          {missingMomo.length === 1 ? "is" : "are"} next up on {formatDate(nextUpRow.date)} —{" "}
          {onOpenGroupSetup ? (
            <button type="button" className="inline-alert-link" onClick={onOpenGroupSetup}>
              check in Group Setup
            </button>
          ) : (
            "check with them"
          )}
        </p>
      )}

      {myLoanTotal > 0 && (
        <div className="loan-alert-banner">
          <span><Icon name="warning" size={14} className="icon-inline" /> You owe <strong>{money(loanTotalDisplay)}</strong> on a loan from the group fund</span>
        </div>
      )}

      {/* 4 — more: plain list rows, same handlers as before */}
      <div className="ledger-section">
        <div className="ledger-section-label">More</div>
        <ul className="ledger-list" role="list">
          {onOpenPaymentOptions && (
            <li>
              <button type="button" className="ledger-list-row" onClick={onOpenPaymentOptions}>
                <span>Payment options</span>
                <span className="ledger-list-chevron" aria-hidden="true">›</span>
              </button>
            </li>
          )}
          {isAdmin && onOpenGroupSetup && (
            <li>
              <button type="button" className="ledger-list-row" onClick={onOpenGroupSetup} data-tour="manage-group">
                <span>Roster &amp; admins</span>
                <span className="ledger-list-chevron" aria-hidden="true">›</span>
              </button>
            </li>
          )}
          <li>
            <button
              type="button"
              className="ledger-list-row"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              <span>Full breakdown</span>
              <span className={"ledger-list-chevron" + (expanded ? " ledger-list-chevron-open" : "")} aria-hidden="true">›</span>
            </button>
          </li>
        </ul>
      </div>

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
    </div>
  );
}
