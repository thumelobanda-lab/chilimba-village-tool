import React, { useState } from "react";
import { payeesLabel } from "../lib/scheduleUtils.js";

function formatDate(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  if (isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-ZM", { day: "numeric", month: "short" });
}

function dismissKey(groupSlug, rowId) {
  return `chilimba:dismissed-payout:${groupSlug}:${rowId}`;
}

/**
 * A brief, group-wide "someone just got paid out" acknowledgment —
 * shown for a payout date within the last couple of days (see
 * findRecentPayout in dashboardMath.js), dismissible, and remembered as
 * dismissed per group+date so it never nags. Naturally time-bounded even
 * without dismissing it: once the date falls outside that window,
 * findRecentPayout stops returning it at all. Deliberately NOT a toast/
 * confetti moment — a plain banner, gone the moment you close it or the
 * moment falls out of the window, whichever comes first.
 */
export default function PayoutAcknowledgment({ groupSlug, row }) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(dismissKey(groupSlug, row.id)) === "1"
  );
  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(dismissKey(groupSlug, row.id), "1");
    setDismissed(true);
  };

  return (
    <div className="payout-ack" role="status">
      <span>
        🎉 <strong>{payeesLabel(row)}</strong> received their payout on {formatDate(row.date)} —
        congratulations!
      </span>
      <button className="payout-ack-dismiss" onClick={handleDismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
