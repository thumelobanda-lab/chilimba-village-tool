import React, { useState } from "react";

/**
 * A collapsed-by-default section with an icon, title, and an at-a-glance
 * summary (e.g. "24 dates set up") visible even when closed — so an
 * admin can see the shape of the whole setup without opening anything,
 * and only expand the one thing they actually came to change.
 */
export default function CollapsibleSection({ icon, title, summary, defaultOpen = false, children }) {
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
        {summary && <span className="setup-section-summary">{summary}</span>}
        <span className={"setup-section-chevron" + (open ? " setup-section-chevron-open" : "")}>▸</span>
      </button>
      {open && <div className="setup-section-body">{children}</div>}
    </div>
  );
}
