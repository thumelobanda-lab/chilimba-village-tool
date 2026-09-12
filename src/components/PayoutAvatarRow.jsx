import React from "react";
import { daysUntil, receiveTimingPhrase, compactReceiveLabel } from "../lib/dashboardMath.js";
import Avatar from "./Avatar.jsx";

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
 * purely presentational. No color-key legend below the strip anymore —
 * each avatar's `title` tooltip plus its own day-count label already say
 * the same thing, and the dashboard's four above-the-fold items need
 * every spare pixel of vertical room they can get (see Dashboard.jsx).
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
              <Avatar
                name={r.name}
                hasPhoto={r.hasPhoto}
                photoDataUrl={r.photoDataUrl}
                size={r.isCurrentUser ? 38 : 32}
                bordered={false}
              />
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
    </div>
  );
}
