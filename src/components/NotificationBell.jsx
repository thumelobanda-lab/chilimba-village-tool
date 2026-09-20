import React, { useEffect, useRef, useState } from "react";
import { parseServerTimestamp } from "../lib/serverTime.js";
import Icon from "./Icon.jsx";
import EmptyState from "./EmptyState.jsx";

function timeAgo(serverTimestamp) {
  if (!serverTimestamp) return "";
  const diff = Date.now() - parseServerTimestamp(serverTimestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const KIND_ICON = {
  owner: <Icon name="sparkle" size={13} className="icon-inline" />,
  notice: <Icon name="megaphone" size={13} className="icon-inline" />,
  payment: <Icon name="money" size={13} className="icon-inline" />,
  reminder: <Icon name="bell" size={13} className="icon-inline" />,
};

/**
 * The header's notification indicator — visible on every tab, not just
 * Home, since a new owner message or a payment status change is just as
 * relevant while looking at Reminders as it is on the dashboard. See
 * useNotifications.js for what feeds into `items` and how dismissing
 * each kind actually works.
 *
 * `urgent` is a separate, stronger signal from the plain unread count —
 * currently just "an admin has a payment confirmation waiting" (see
 * App.jsx's pendingConfirmCount) — for a time-sensitive action that a
 * quiet number badge doesn't convey. It pulses/glows and persists across
 * every tab, not just Home, until the pending queue is actually cleared.
 *
 * `markSeen` (from useNotifications.js) is called once on close, for
 * whatever was in `items` at that point — not on open — so a member
 * gets one full look at an item styled as unread before it settles into
 * the plainer "read" treatment on their next visit. Read/unread is only
 * ever a visual style here; dismissing (below) is still what actually
 * removes an item from the list.
 */
export default function NotificationBell({ items, urgent, markSeen }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  // Tracks whether the panel has actually been open, so the effect below
  // only marks items seen on a real open -> closed transition — not on
  // first mount, which would otherwise mark everything seen before the
  // member ever looked at the bell.
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function handleKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    markSeen?.(items.map((item) => item.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const count = items.length;

  return (
    <div className="notification-bell" ref={wrapRef}>
      <button
        className={"btn-ghost header-icon-btn notification-bell-trigger" + (urgent ? " notification-bell-trigger-urgent" : "")}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={
          urgent
            ? "Notifications — a payment confirmation is waiting for review"
            : count > 0
              ? `${count} unread notification${count === 1 ? "" : "s"}`
              : "Notifications"
        }
        title={urgent ? "A payment confirmation is waiting for review" : "Notifications"}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="bell" size={18} />
        {(count > 0 || urgent) && (
          <span className={"notification-bell-badge" + (urgent ? " notification-bell-badge-urgent" : "")}>
            {count > 0 ? (count > 9 ? "9+" : count) : "!"}
          </span>
        )}
      </button>
      {open && (
        <div className="notification-bell-panel" role="menu">
          <div className="notification-bell-heading">Notifications</div>
          {items.length === 0 ? (
            // No action button here, deliberately — unlike the other
            // empty states (payments/members/fund), "caught up" isn't a
            // "go do X" prompt, it's a resting state with nothing
            // meaningful to act on.
            <EmptyState icon="emptyNotifications" message="You're all caught up." size={44} />
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={"notification-item" + (item.read ? " notification-item-read" : " notification-item-unread")}
              >
                <span aria-hidden="true" className="notification-item-icon">{KIND_ICON[item.kind] || "•"}</span>
                <div className="notification-item-body">
                  <p className="notification-item-text">{item.text}</p>
                  <div className="notification-item-footer">
                    {item.at && <span className="notification-item-time tiny">{timeAgo(item.at)}</span>}
                    <button className="btn-link" onClick={item.dismiss}>Dismiss</button>
                  </div>
                </div>
                {!item.read && <span className="notification-item-dot" aria-hidden="true" title="Unread" />}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
