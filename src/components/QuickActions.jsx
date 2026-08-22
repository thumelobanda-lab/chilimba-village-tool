import React from "react";

/**
 * A row of one-tap shortcuts to the actions members reach for most often
 * — deliberately just 3, not a menu duplicate: Log a Payment and Payment
 * Options are universal, the third slot is role-aware (Roster for an
 * admin, since managing who's in the group is admin-only; Reminders for
 * a regular member, since it's equally universal but Roster isn't
 * reachable for them at all).
 */
export default function QuickActions({ isAdmin, onOpenLedger, onOpenPaymentOptions, onOpenGroupSetup, onOpenReminders }) {
  const actions = [
    { icon: "💸", label: "Log a Payment", onClick: onOpenLedger },
    { icon: "📱", label: "Payment Options", onClick: onOpenPaymentOptions },
    isAdmin
      ? { icon: "👥", label: "Roster", onClick: onOpenGroupSetup }
      : { icon: "🔔", label: "Reminders", onClick: onOpenReminders },
  ];

  return (
    <div className="quick-actions">
      {actions.map((a) => (
        <button key={a.label} className="quick-action-btn" onClick={a.onClick} disabled={!a.onClick}>
          <span className="quick-action-icon" aria-hidden="true">{a.icon}</span>
          <span className="quick-action-label">{a.label}</span>
        </button>
      ))}
    </div>
  );
}
