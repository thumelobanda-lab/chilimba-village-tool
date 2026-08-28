import React from "react";

/**
 * Shared save-confirmation toast — floats above the bottom of the
 * viewport instead of the small, easy-to-miss inline text each save
 * flow used to render on its own (GroupSetup.jsx/AdminManagement.jsx/
 * Loans.jsx/Reminders.jsx/PaymentOptions.jsx/Profile.jsx all had the
 * identical local status-string-plus-timeout pattern; this only
 * standardizes how that status is *shown*, not who owns it). "Saving…"
 * (the in-flight state, always ending in the app's ellipsis convention)
 * renders as-is; anything else is a completed confirmation and gets a
 * checkmark.
 */
export default function Toast({ message }) {
  if (!message) return null;
  const inFlight = message.endsWith("…");
  return (
    <div className="toast" role="status" aria-live="polite">
      {inFlight ? message : `✓ ${message}`}
    </div>
  );
}
