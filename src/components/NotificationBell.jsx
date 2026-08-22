import React, { useEffect, useRef, useState } from "react";
import { parseServerTimestamp } from "../lib/serverTime.js";

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

const KIND_ICON = { owner: "✦", notice: "📢", payment: "💸", reminder: "🔔" };

/**
 * The header's notification indicator — visible on every tab, not just
 * Home, since a new owner message or a payment status change is just as
 * relevant while looking at Reminders as it is on the dashboard. See
 * useNotifications.js for what feeds into `items` and how dismissing
 * each kind actually works.
 */
export default function NotificationBell({ items }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

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

  const count = items.length;

  return (
    <div className="notification-bell" ref={wrapRef}>
      <button
        className="btn-ghost notification-bell-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={count > 0 ? `${count} unread notification${count === 1 ? "" : "s"}` : "Notifications"}
        title="Notifications"
        onClick={() => setOpen((o) => !o)}
      >
        🔔
        {count > 0 && <span className="notification-bell-badge">{count > 9 ? "9+" : count}</span>}
      </button>
      {open && (
        <div className="notification-bell-panel" role="menu">
          <div className="notification-bell-heading">Notifications</div>
          {items.length === 0 ? (
            <p className="muted small" style={{ padding: "8px 12px 12px" }}>You're all caught up.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="notification-item">
                <span aria-hidden="true" className="notification-item-icon">{KIND_ICON[item.kind] || "•"}</span>
                <div className="notification-item-body">
                  <p className="notification-item-text">{item.text}</p>
                  <div className="notification-item-footer">
                    {item.at && <span className="muted tiny">{timeAgo(item.at)}</span>}
                    <button className="btn-link" onClick={item.dismiss}>Dismiss</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
