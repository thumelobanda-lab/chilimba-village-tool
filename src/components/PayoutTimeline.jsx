import React, { useRef } from "react";
import { daysUntil, receiveTimingPhrase } from "../lib/dashboardMath.js";
import MemberPreviewPopover from "./MemberPreviewPopover.jsx";

const LONG_PRESS_MS = 550;

function formatDate(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  if (isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-ZM", { day: "numeric", month: "short" });
}

function statusWord(status) {
  if (status === "received") return "Received";
  if (status === "next") return "Next";
  return "Upcoming";
}

function statusLabel(status) {
  if (status === "received") return "already received this cycle";
  if (status === "next") return "next in line";
  return "upcoming";
}

/**
 * "Who receives" — a plain vertical timeline (dot + name + status/date)
 * down the payout rotation, replacing the old horizontally-scrolling
 * avatar strip with the same underlying data and interactions: `rows` is
 * still buildPayoutAvatarRow's output (dashboardMath.js) — this file
 * only changed how it's displayed, not the rotation logic itself.
 *
 * Tapping any row still opens the shared MemberPreviewPopover (name,
 * photo, "Change photo" only on your own) — unrelated to the payment
 * animation below, and handled entirely by that click, not the
 * long-press timer.
 *
 * `animateTransition`, when set to `{ completedNames, nextNames }` (both
 * arrays, since a date can have multiple payees) by Dashboard.jsx (see
 * its own doc comment on the cycle-completion trigger), plays a one-shot
 * understated pop on the just-completed row(s) plus a highlight on the
 * new next-up row — same trigger as before, adapted from a horizontal
 * traveling dot to a vertical one between list items (see
 * .ledger-timeline-connector in styles.css). Calls `onAnimationDone`
 * once so the parent can clear the one-shot flag.
 *
 * `onSendReminder(name)`, when provided (admin sessions only — see
 * Dashboard.jsx), is wired to a long-press on the "next" row as a
 * shortcut to nudge whoever's turn it is, without leaving the dashboard
 * for the full Reminders tab.
 */
export default function PayoutTimeline({ rows, animateTransition, onAnimationDone, onSendReminder }) {
  const pressTimer = useRef(null);
  const pressFired = useRef(false);

  if (!rows || rows.length === 0) return null;

  const nextRows = rows.filter((r) => r.status === "next");

  const startPress = (name) => {
    if (!onSendReminder) return;
    pressFired.current = false;
    pressTimer.current = setTimeout(() => {
      pressFired.current = true;
      onSendReminder(name);
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => {
    clearTimeout(pressTimer.current);
  };

  return (
    <div className="ledger-section">
      <div className="ledger-section-label">Who receives</div>
      {nextRows.length > 0 && (
        <p className="ledger-timeline-headline">
          <strong>{nextRows.map((r) => r.name).join(" / ")}</strong>{" "}
          {nextRows.length === 1 ? "receives" : "receive"} {receiveTimingPhrase(daysUntil(nextRows[0].date))}
        </p>
      )}
      <ul className="ledger-timeline" role="list">
        {rows.map((r, i) => {
          const justCompleted = !!animateTransition?.completedNames.includes(r.name) && r.status === "received";
          const isNewNext = !!animateTransition?.nextNames.includes(r.name) && r.status === "next";
          const showConnector =
            !!animateTransition &&
            animateTransition.completedNames.includes(r.name) &&
            animateTransition.nextNames.includes(rows[i + 1]?.name);
          const canLongPress = r.status === "next" && !!onSendReminder;

          return (
            <li
              key={`${r.name}-${i}`}
              className={
                "ledger-timeline-item" +
                ` ledger-timeline-${r.status}` +
                (r.isCurrentUser ? " ledger-timeline-you" : "") +
                (justCompleted ? " ledger-timeline-pop" : "") +
                (isNewNext ? " ledger-timeline-just-next" : "")
              }
            >
              <span className="ledger-timeline-dot" aria-hidden="true" />
              {showConnector && (
                <span className="ledger-timeline-connector" aria-hidden="true" onAnimationEnd={onAnimationDone} />
              )}
              <MemberPreviewPopover
                name={r.name}
                hasPhoto={r.hasPhoto}
                photoDataUrl={r.photoDataUrl}
                isSelf={r.isCurrentUser}
                subtitle={statusLabel(r.status)}
                triggerSize={24}
                triggerBordered={false}
                triggerClassName="ledger-timeline-avatar"
                triggerTitle={`${r.name}${r.isCurrentUser ? " (you)" : ""} — ${statusLabel(r.status)}${
                  canLongPress ? " — hold to send a reminder" : ""
                }`}
                triggerProps={
                  canLongPress
                    ? {
                        onMouseDown: () => startPress(r.name),
                        onMouseUp: cancelPress,
                        onMouseLeave: cancelPress,
                        onTouchStart: () => startPress(r.name),
                        onTouchEnd: cancelPress,
                        onTouchCancel: cancelPress,
                        onClick: (e) => {
                          // Suppress the preview-open tap that immediately
                          // follows a fired long-press (touchend/mouseup
                          // both fire a click right after) so it doesn't
                          // also pop the panel open on top of the reminder.
                          if (pressFired.current) {
                            e.preventDefault();
                            e.stopPropagation();
                            pressFired.current = false;
                          }
                        },
                      }
                    : undefined
                }
              />
              <span className="ledger-timeline-name">
                {r.name}
                {r.isCurrentUser && <span className="ledger-timeline-you-tag">you</span>}
              </span>
              <span className="ledger-timeline-status">
                {statusWord(r.status)} · {formatDate(r.date)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
