import React from "react";

// The 3 destinations members actually reach for constantly, plus a
// catch-all Menu tab that opens the same NavMenu panel the header
// hamburger does (see App.jsx, which owns the shared open/close state
// for both) — everything else (receipts, payment options, reminders,
// admin tools, etc) still lives one tap behind Menu, this just stops
// the 3 most common ones from requiring the menu at all. Mobile-only
// (see .bottom-tab-bar's media query in styles.css) — on a wider screen
// there's already room for the hamburger to be a low-friction "everything
// lives in one place" affordance.
const PRIMARY_TABS = [
  { id: "home", label: "Dashboard", icon: "🏠" },
  { id: "ledger", label: "Payments", icon: "💳" },
  { id: "community", label: "Community", icon: "🤝" },
];

export default function BottomTabBar({ activeId, onSelect, onOpenMenu, menuOpen, hasMenuBadge }) {
  return (
    <nav className="bottom-tab-bar" aria-label="Primary">
      {PRIMARY_TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={"bottom-tab" + (activeId === t.id ? " bottom-tab-active" : "")}
          onClick={() => onSelect(t.id)}
          aria-current={activeId === t.id ? "page" : undefined}
        >
          <span className="bottom-tab-icon" aria-hidden="true">{t.icon}</span>
          <span className="bottom-tab-label">{t.label}</span>
        </button>
      ))}
      <button
        type="button"
        className={"bottom-tab" + (menuOpen ? " bottom-tab-active" : "")}
        onClick={onOpenMenu}
        aria-haspopup="true"
        aria-expanded={menuOpen}
        aria-label={hasMenuBadge ? "Menu — new items to review" : "Menu"}
      >
        <span className="bottom-tab-icon" aria-hidden="true">☰</span>
        <span className="bottom-tab-label">Menu</span>
        {hasMenuBadge && <span className="bottom-tab-dot" aria-hidden="true" />}
      </button>
    </nav>
  );
}
