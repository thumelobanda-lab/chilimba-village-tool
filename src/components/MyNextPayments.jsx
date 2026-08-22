import React from "react";
import { money } from "./LedgerTable.jsx";

function formatDate(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  if (isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-ZM", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * A member's own next few due dates, not just the single soonest one on
 * the "Next Payment Due" stat card — see myNextDueDates in
 * scheduleUtils.js for the forward-projection rules: real schedule
 * dates first, only extrapolating (clearly marked "Estimated") once
 * those run out. Reuses the same calendar-chip row styling as the
 * group-wide UpcomingDates panel, just personalized to this member.
 */
export default function MyNextPayments({ rows }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="panel upcoming-panel">
      <div className="vital-card-label">Your Next Payments</div>
      <div className="upcoming-list">
        {rows.map((r, i) => (
          <div className="upcoming-item" key={r.row?.id || `projected-${i}`}>
            <div className="upcoming-item-date">
              <div className="upcoming-item-day">{formatDate(r.date)}</div>
              {r.projected && <div className="muted tiny">Estimated</div>}
            </div>
            <div className="upcoming-item-info">
              <div className="upcoming-item-payee">
                {r.row?.group || (r.projected ? "Projected from your schedule" : "")}
              </div>
            </div>
            <div className="upcoming-item-amount">{r.due != null ? money(r.due) : "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
