import React, { useEffect, useRef } from "react";
import Icon from "./Icon.jsx";

/**
 * Hamburger nav menu — everything that isn't one of BottomTabBar's 3
 * pinned destinations (Dashboard/Payments/Community — see
 * BottomTabBar.jsx) plus "How this app works" to reopen the spotlight
 * tour (see SpotlightTour.jsx). Admin-only items render under their own
 * "Admin Tools" heading rather than blending into the member-facing
 * list, so the two audiences read as visually distinct groups in what's
 * otherwise one flat menu.
 *
 * Open/closed state is owned by App.jsx (not this component) so
 * BottomTabBar's Menu tab and the header's hamburger trigger can control
 * the exact same panel instead of each having their own independent one.
 * Closes on selection, Escape, or a click outside the panel.
 *
 * Styled with the dashboard's ledger palette/list-row pattern (see
 * styles.css's .dashboard-ledger token block and .ledger-list-row) —
 * every item here is a plain label+chevron row, grouped into
 * .ledger-section blocks (border-top as the section divider, same as
 * the dashboard) rather than the old boxed nav-menu-item styling. Purely
 * visual: selection, admin-only grouping, and every item's destination
 * are unchanged.
 */
export default function NavMenu({ items, activeId, onSelect, onOpenSpotlightTour, theme, onToggleTheme, open, onToggle, onClose }) {
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) onClose();
    }
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  const select = (id) => {
    onSelect(id);
    onClose();
  };

  // Persistent indicator (not a dismissible toast) that something in the
  // menu is waiting to be seen — e.g. a newly confirmed receipt (see
  // useReceipts.js). Visible on the collapsed trigger itself so it
  // doesn't require opening the menu first to notice.
  const hasBadge = items.some((t) => t.badge > 0);
  const memberItems = items.filter((t) => !t.adminOnly);
  const adminItems = items.filter((t) => t.adminOnly);

  const renderItem = (t) => (
    <button
      key={t.id}
      role="menuitem"
      className={"ledger-list-row" + (activeId === t.id ? " ledger-list-row-active" : "")}
      onClick={() => select(t.id)}
    >
      <span>
        {t.label}
        {t.badge > 0 && <span className="nav-badge">{t.badge > 9 ? "9+" : t.badge}</span>}
      </span>
      <span className="ledger-list-chevron" aria-hidden="true">›</span>
    </button>
  );

  return (
    <div className="nav-menu" ref={wrapRef}>
      <button
        className="nav-menu-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={hasBadge ? "Open menu — new items to review" : "Open menu"}
        onClick={onToggle}
      >
        <span aria-hidden="true">☰</span> Menu
        {hasBadge && <span className="nav-menu-trigger-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="nav-menu-panel" role="menu">
          <div className="ledger-list">{memberItems.map(renderItem)}</div>

          {adminItems.length > 0 && (
            <div className="ledger-section">
              <div className="ledger-section-label" role="presentation">Admin Tools</div>
              <div className="ledger-list">{adminItems.map(renderItem)}</div>
            </div>
          )}

          <div className="ledger-section">
            <div className="ledger-list">
              {onToggleTheme && (
                <button
                  role="menuitem"
                  className="ledger-list-row"
                  onClick={() => {
                    onToggleTheme();
                    onClose();
                  }}
                >
                  <span>
                    <Icon name={theme === "dark" ? "sun" : "moon"} size={14} className="icon-inline" />{" "}
                    {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  </span>
                  <span className="ledger-list-chevron" aria-hidden="true">›</span>
                </button>
              )}
              <button
                role="menuitem"
                className="ledger-list-row"
                onClick={() => {
                  onOpenSpotlightTour();
                  onClose();
                }}
              >
                <span>How this app works</span>
                <span className="ledger-list-chevron" aria-hidden="true">›</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
