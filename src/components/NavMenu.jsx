import React, { useEffect, useRef, useState } from "react";

/**
 * Hamburger nav menu — the one place every screen that isn't the home
 * dashboard now lives (ledger, calculator summary, reminders, community,
 * account, and admin-only setup/reconciliation/loans), plus "How this
 * app works" to reopen the walkthrough. Replaces the always-visible tab
 * bar that used to sit on the home screen. Closes on selection, Escape,
 * or a click outside the panel.
 */
export default function NavMenu({ items, activeId, onSelect, onOpenWalkthrough, theme, onToggleTheme }) {
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

  const select = (id) => {
    onSelect(id);
    setOpen(false);
  };

  // Persistent indicator (not a dismissible toast) that something in the
  // menu is waiting to be seen — e.g. a newly confirmed receipt (see
  // useReceipts.js). Visible on the collapsed trigger itself so it
  // doesn't require opening the menu first to notice.
  const hasBadge = items.some((t) => t.badge > 0);

  return (
    <div className="nav-menu" ref={wrapRef}>
      <button
        className="nav-menu-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={hasBadge ? "Open menu — new items to review" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">☰</span> Menu
        {hasBadge && <span className="nav-menu-trigger-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="nav-menu-panel" role="menu">
          {items.map((t) => (
            <button
              key={t.id}
              role="menuitem"
              className={activeId === t.id ? "nav-menu-item nav-menu-item-active" : "nav-menu-item"}
              onClick={() => select(t.id)}
            >
              {t.label}
              {t.badge > 0 && <span className="nav-badge">{t.badge > 9 ? "9+" : t.badge}</span>}
            </button>
          ))}
          <div className="nav-menu-divider" />
          {onToggleTheme && (
            <button
              role="menuitem"
              className="nav-menu-item"
              onClick={() => {
                onToggleTheme();
                setOpen(false);
              }}
            >
              {theme === "dark" ? "☀️ Switch to Light Mode" : "🌙 Switch to Dark Mode"}
            </button>
          )}
          <button
            role="menuitem"
            className="nav-menu-item"
            onClick={() => {
              onOpenWalkthrough();
              setOpen(false);
            }}
          >
            How this app works
          </button>
        </div>
      )}
    </div>
  );
}
