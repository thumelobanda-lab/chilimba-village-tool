import React from "react";
import { daysUntil, receiveTimingPhrase, compactReceiveLabel } from "../lib/dashboardMath.js";

function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function statusLabel(status) {
  if (status === "received") return "already received this cycle";
  if (status === "next") return "next in line";
  return "upcoming";
}

/**
 * A slim, horizontally-scrollable strip near the progress ring showing
 * where the rotation actually is right now — the last couple of people
 * paid out, then who's coming up next, with the signed-in member always
 * visible among them (larger, gold-glowing) even if their own turn is
 * further out than the rest of the strip shows. `rows` is
 * buildPayoutAvatarRow's output (dashboardMath.js) — this component is
 * purely presentational.
 */
export default function PayoutAvatarRow({ rows }) {
  if (!rows || rows.length === 0) return null;

  // Usually a single entry, but a date can have up to 3 payees (see
  // buildPayoutAvatarRow), so more than one row can share "next".
  const nextRows = rows.filter((r) => r.status === "next");

  return (
    <div className="payout-avatar-block">
      {nextRows.length > 0 && (
        <p className="payout-avatar-headline">
          <strong>{nextRows.map((r) => r.name).join(" / ")}</strong>{" "}
          {nextRows.length === 1 ? "receives" : "receive"} {receiveTimingPhrase(daysUntil(nextRows[0].date))}
        </p>
      )}
      <div className="payout-avatar-row">
        {rows.map((r, i) => (
          <div key={`${r.name}-${i}`} className="payout-avatar-step">
            <div
              className={
                "payout-avatar" +
                ` payout-avatar-${r.status}` +
                (r.isCurrentUser ? " payout-avatar-you" : "")
              }
              title={`${r.name}${r.isCurrentUser ? " (you)" : ""} — ${statusLabel(r.status)}`}
            >
              <span className="payout-avatar-initials">{initials(r.name)}</span>
            </div>
            <div
              className={
                "payout-avatar-step-label" + (r.status === "next" ? " payout-avatar-step-label-next" : "")
              }
            >
              {compactReceiveLabel(daysUntil(r.date))}
            </div>
          </div>
        ))}
      </div>
      <div className="payout-avatar-legend">
        <span><i className="payout-avatar-dot payout-avatar-dot-received" aria-hidden="true" /> Received</span>
        <span><i className="payout-avatar-dot payout-avatar-dot-next" aria-hidden="true" /> Next in line</span>
        <span><i className="payout-avatar-dot payout-avatar-dot-upcoming" aria-hidden="true" /> Upcoming</span>
      </div>
    </div>
  );
}
