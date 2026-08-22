import React from "react";

/**
 * One-tap shortcuts to the actions members reach for most often — not a
 * menu duplicate: Log a Payment, Payment Options, and Community Fund
 * details are universal; Roster & Admins is admin-only, since managing
 * who's in the group is an admin-only capability (GroupSetup.jsx's
 * Members & Group Leaders section) with nothing for a regular member to
 * reach there at all.
 */
export default function QuickActions({ isAdmin, onOpenLedger, onOpenPaymentOptions, onOpenGroupSetup, onOpenCommunity }) {
  const actions = [
    { icon: "💸", label: "Log a Payment", onClick: onOpenLedger },
    { icon: "📱", label: "Payment Options", onClick: onOpenPaymentOptions },
    isAdmin && { icon: "👥", label: "Roster & Admins", onClick: onOpenGroupSetup },
    { icon: "🤝", label: "Community Fund", onClick: onOpenCommunity },
  ].filter(Boolean);

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
