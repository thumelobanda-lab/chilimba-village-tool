import React from "react";

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

  return (
    <div className="payout-avatar-block">
      <div className="payout-avatar-row">
        {rows.map((r, i) => (
          <div
            key={`${r.name}-${i}`}
            className={
              "payout-avatar" +
              ` payout-avatar-${r.status}` +
              (r.isCurrentUser ? " payout-avatar-you" : "")
            }
            title={`${r.name}${r.isCurrentUser ? " (you)" : ""} — ${statusLabel(r.status)}`}
          >
            <span className="payout-avatar-initials">{initials(r.name)}</span>
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
