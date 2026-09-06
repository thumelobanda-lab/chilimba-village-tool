import React, { useState } from "react";

/**
 * A collapsed-by-default section with an icon, title, and an at-a-glance
 * summary (e.g. "24 dates set up") visible even when closed — so an
 * admin can see the shape of the whole setup without opening anything,
 * and only expand the one thing they actually came to change.
 *
 * `done` is optional — only the sections GroupSetup.jsx considers part
 * of its "X of N set up" progress readout pass it, so a section with
 * nothing to complete (e.g. Invite Members) just omits the prop rather
 * than showing a meaningless checkmark either way.
 */
export default function CollapsibleSection({ icon, title, summary, done, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="setup-section">
      <button
        type="button"
        className="setup-section-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="setup-section-icon">{icon}</span>
        <span className="setup-section-title">{title}</span>
        {done !== undefined && (
          <span className={"badge setup-section-badge" + (done ? " badge-ok" : " badge-todo")}>
            {done ? "✓ set up" : "not set up yet"}
          </span>
        )}
        {summary && <span className="setup-section-summary">{summary}</span>}
        <span className={"setup-section-chevron" + (open ? " setup-section-chevron-open" : "")}>▸</span>
      </button>
      {open && <div className="setup-section-body">{children}</div>}
    </div>
  );
}
