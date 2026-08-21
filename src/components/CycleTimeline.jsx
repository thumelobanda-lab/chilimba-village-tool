import React from "react";
import { payeesLabel } from "../lib/scheduleUtils.js";

function formatShortDate(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  if (isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-ZM", { day: "numeric", month: "short" });
}

/**
 * A horizontal, per-date strip of the cycle's payout schedule — each
 * date a node showing whether that member's turn has already happened
 * (✓), is coming up next (highlighted), or is still further out. Static
 * by design in this first pass — no animation, no fetch of its own; it
 * renders from the same `rows` (already schedule.js data, tagged by
 * buildCycleTimeline in dashboardMath.js) the rest of the dashboard
 * already has in hand, so it costs nothing extra to show.
 */
export default function CycleTimeline({ rows }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="cycle-timeline-wrap">
      <div className="cycle-timeline">
        {rows.map((row) => (
          <div className={`cycle-node cycle-node-${row.status}`} key={row.id}>
            <div className="cycle-node-dot" aria-hidden="true">{row.status === "past" ? "✓" : ""}</div>
            <div className="cycle-node-date">{formatShortDate(row.date)}</div>
            <div className="cycle-node-payee">{payeesLabel(row)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
