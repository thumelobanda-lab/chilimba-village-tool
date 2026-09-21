import React, { useState } from "react";
import Icon from "./Icon.jsx";

/**
 * A small inline "ⓘ" toggle for detail that's rarely needed but
 * shouldn't be lost entirely — tap to reveal a short explanation right
 * below it, collapsed by default. Used to keep a screen's own copy down
 * to a heading plus one short line, without deleting the longer
 * explanation some members will still want. Never used for error text,
 * money confirmations, or anything needed to prevent a mistake — those
 * stay inline, always visible.
 */
export default function InfoTip({ label = "More info", children }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="info-tip">
      <button
        type="button"
        className="info-tip-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label}
      >
        <Icon name="info" size={13} className="icon-inline" />
      </button>
      {open && <span className="info-tip-body">{children}</span>}
    </span>
  );
}
