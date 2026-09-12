import React from "react";
import Icon from "./Icon.jsx";

// The wide-screen counterpart to BottomTabBar.jsx's 3 pinned destinations
// (Dashboard/Payments/Community) — that component only renders at
// max-width:640px (see .bottom-tab-bar in styles.css), so above that
// width there was no persistent nav at all: every tab, including
// Payments, sat one click behind the ☰ Menu trigger next to this. Same
// PRIMARY_TABS list on purpose, kept in sync by hand since the two never
// render at the same width (see the exact-complement breakpoints in
// styles.css: .bottom-tab-bar's max-width:640px vs. .desktop-tab-bar's
// min-width:641px).
const PRIMARY_TABS = [
  { id: "home", label: "Dashboard", icon: "home" },
  { id: "ledger", label: "Payments", icon: "card" },
  { id: "community", label: "Community", icon: "people" },
];

export default function DesktopTabBar({ activeId, onSelect }) {
  return (
    <nav className="desktop-tab-bar" aria-label="Primary">
      {PRIMARY_TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={"desktop-tab" + (activeId === t.id ? " desktop-tab-active" : "")}
          onClick={() => onSelect(t.id)}
          aria-current={activeId === t.id ? "page" : undefined}
        >
          <span aria-hidden="true"><Icon name={t.icon} size={16} className="icon-inline" /></span> {t.label}
        </button>
      ))}
    </nav>
  );
}
