import React, { useRef } from "react";
import { daysUntil, receiveTimingPhrase, compactReceiveLabel } from "../lib/dashboardMath.js";
import MemberPreviewPopover from "./MemberPreviewPopover.jsx";
import Icon from "./Icon.jsx";

const LONG_PRESS_MS = 550;

function statusLabel(status) {
  if (status === "received") return "already received this cycle";
  if (status === "next") return "next in line";
  return "upcoming";
}

/**
 * A slim, horizontally-scrollable strip near the progress ring showing
 * where the rotation actually is right now — the last couple of people
 * paid out, then who's coming up next, with the signed-in member always
 * visible among them (larger, gold-glowing) even if their own turn is
 * further out than the rest of the strip shows. `rows` is
 * buildPayoutAvatarRow's output (dashboardMath.js).
 *
 * Tapping any avatar opens the shared MemberPreviewPopover (name, photo,
 * "Change photo" only on your own) — unrelated to the payment animation
 * below, and handled entirely by that click, not by the long-press timer.
 *
 * `animateTransition`, when set to `{ completedNames, nextNames }` (both
 * arrays, since a date can have multiple payees) by Dashboard.jsx (see
 * its own doc comment on the cycle-completion trigger), plays a one-shot,
 * understated pop on the just-completed avatar(s) plus a small dot
 * traveling to the new next-up avatar, which then starts its pulsing
 * ring — CSS-only animation, see styles.css's
 * .payout-avatar-pop/.payout-avatar-connector-dot. Calls
 * `onAnimationDone` once so the parent can clear the one-shot flag and
 * this doesn't replay on the next unrelated re-render.
 *
 * `onSendReminder(name)`, when provided (admin sessions only — see
 * Dashboard.jsx), is wired to a long-press on the "next" avatar as a
 * shortcut to nudge whoever's turn it is, without leaving the dashboard
 * for the full Reminders tab.
 */
export default function PayoutAvatarRow({ rows, animateTransition, onAnimationDone, onSendReminder }) {
  const pressTimer = useRef(null);
  const pressFired = useRef(false);

  if (!rows || rows.length === 0) return null;

  // Usually a single entry, but a date can have up to 3 payees (see
  // buildPayoutAvatarRow), so more than one row can share "next".
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
    <div className="payout-avatar-block">
      {nextRows.length > 0 && (
        <p className="payout-avatar-headline">
          <strong>{nextRows.map((r) => r.name).join(" / ")}</strong>{" "}
          {nextRows.length === 1 ? "receives" : "receive"} {receiveTimingPhrase(daysUntil(nextRows[0].date))}
        </p>
      )}
      <div className="payout-avatar-row">
        {rows.map((r, i) => {
          const justCompleted = !!animateTransition?.completedNames.includes(r.name) && r.status === "received";
          const isNewNext = !!animateTransition?.nextNames.includes(r.name) && r.status === "next";
          const showConnector =
            !!animateTransition &&
            animateTransition.completedNames.includes(r.name) &&
            animateTransition.nextNames.includes(rows[i + 1]?.name);
          const canLongPress = r.status === "next" && !!onSendReminder;

          return (
            <React.Fragment key={`${r.name}-${i}`}>
              <div className="payout-avatar-step">
                <MemberPreviewPopover
                  name={r.name}
                  hasPhoto={r.hasPhoto}
                  photoDataUrl={r.photoDataUrl}
                  isSelf={r.isCurrentUser}
                  subtitle={statusLabel(r.status)}
                  triggerSize={r.isCurrentUser ? 38 : 32}
                  triggerBordered={false}
                  triggerTitle={`${r.name}${r.isCurrentUser ? " (you)" : ""} — ${statusLabel(r.status)}${
                    canLongPress ? " — hold to send a reminder" : ""
                  }`}
                  triggerClassName={
                    "payout-avatar" +
                    ` payout-avatar-${r.status}` +
                    (r.isCurrentUser ? " payout-avatar-you" : "") +
                    (justCompleted ? " payout-avatar-pop" : "") +
                    (isNewNext ? " payout-avatar-just-next" : "")
                  }
                  badge={
                    r.status === "received" ? (
                      <span className="payout-avatar-check-badge" aria-hidden="true">
                        <Icon name="check" size={9} />
                      </span>
                    ) : null
                  }
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
                <div
                  className={
                    "payout-avatar-step-label" + (r.status === "next" ? " payout-avatar-step-label-next" : "")
                  }
                >
                  {compactReceiveLabel(daysUntil(r.date))}
                </div>
              </div>
              {showConnector && (
                <div className="payout-avatar-connector" aria-hidden="true" onAnimationEnd={onAnimationDone}>
                  <span className="payout-avatar-connector-dot" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
