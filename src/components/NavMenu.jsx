import React, { useEffect, useRef, useState } from "react";

/**
 * Hamburger nav menu — the one place every screen that isn't the home
 * dashboard now lives (ledger, calculator summary, reminders, community,
 * account, and admin-only setup/reconciliation/loans), plus "How this
 * app works" to reopen the walkthrough. Replaces the always-visible tab
 * bar that used to sit on the home screen. Closes on selection, Escape,
 * or a click outside the panel.
 */
export default function NavMenu({ items, activeId, onSelect, onOpenWalkthrough }) {
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

  return (
    <div className="nav-menu" ref={wrapRef}>
      <button
        className="nav-menu-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Open menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">☰</span> Menu
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
            </button>
          ))}
          <div className="nav-menu-divider" />
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
