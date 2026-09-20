import React from "react";
import Icon from "./Icon.jsx";

/**
 * One shared "nothing here yet" pattern — a badged line icon (see
 * Icon.jsx's empty* glyphs), a short formal message, and whatever action
 * the caller wants (a plain button, a stateful one like LedgerTable's
 * PayButton, or nothing at all when no action genuinely applies). Used
 * for the four empty states this app has: no payments, no members, no
 * notifications, and an unconfigured Group Savings Fund — replacing what
 * used to be either a bare sentence or, in the payments case, a raster
 * illustration that didn't match this app's formal/no-illustration
 * tone. The badge is deliberately two-tone (gold ring, green icon) so it
 * reads as "part of this app's own chrome" rather than a borrowed icon
 * set, and both colors are theme tokens, so it re-tints correctly in
 * dark mode without any extra work here.
 */
export default function EmptyState({ icon, message, size = 56, children }) {
  return (
    <div className="empty-state">
      <span className="empty-state-badge" style={{ width: size, height: size }} aria-hidden="true">
        <Icon name={icon} size={Math.round(size * 0.5)} />
      </span>
      <p className="empty-state-message">{message}</p>
      {children}
    </div>
  );
}
