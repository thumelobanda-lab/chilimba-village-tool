import React, { useEffect, useRef } from "react";
import Icon from "./Icon.jsx";

/**
 * Hamburger nav menu — everything that isn't one of BottomTabBar's 3
 * pinned destinations (Dashboard/Payments/Community — see
 * BottomTabBar.jsx) plus "How this app works" to reopen the walkthrough.
 * Admin-only items render under their own "Admin Tools" heading rather
 * than blending into the member-facing list, so the two audiences read
 * as visually distinct groups in what's otherwise one flat menu.
 *
 * Open/closed state is owned by App.jsx (not this component) so
 * BottomTabBar's Menu tab and the header's hamburger trigger can control
 * the exact same panel instead of each having their own independent one.
 * Closes on selection, Escape, or a click outside the panel.
 */
export default function NavMenu({ items, activeId, onSelect, onOpenWalkthrough, theme, onToggleTheme, open, onToggle, onClose }) {
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
      className={activeId === t.id ? "nav-menu-item nav-menu-item-active" : "nav-menu-item"}
      onClick={() => select(t.id)}
    >
      {t.label}
      {t.badge > 0 && <span className="nav-badge">{t.badge > 9 ? "9+" : t.badge}</span>}
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
          {memberItems.map(renderItem)}
          {adminItems.length > 0 && (
            <>
              <div className="nav-menu-divider" />
              <div className="nav-menu-section-label" role="presentation">Admin Tools</div>
              {adminItems.map(renderItem)}
            </>
          )}
          <div className="nav-menu-divider" />
          {onToggleTheme && (
            <button
              role="menuitem"
              className="nav-menu-item"
              onClick={() => {
                onToggleTheme();
                onClose();
              }}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={14} className="icon-inline" />{" "}
              {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            </button>
          )}
          <button
            role="menuitem"
            className="nav-menu-item"
            onClick={() => {
              onOpenWalkthrough();
              onClose();
            }}
          >
            How this app works
          </button>
        </div>
      )}
    </div>
  );
}
