import React from "react";
import { money } from "./LedgerTable.jsx";
import { payeesLabel } from "../lib/scheduleUtils.js";
import { relativeDueLabel, daysUntil } from "../lib/dashboardMath.js";

function formatDate(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  if (isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-ZM", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * The next few payout dates across the whole group — not just the
 * signed-in member's own next due date — so there's always something
 * relevant to check even between their own payment dates. `rows` is
 * upcomingDates()'s output (dashboardMath.js), already sliced to the
 * dates that matter; built from config.schedule Dashboard.jsx already
 * has in hand, so this costs nothing extra either. Amounts shown are
 * the schedule's own default rate for that date, not any one member's
 * personal override — this is a group-wide view, not a personal one.
 */
export default function UpcomingDates({ rows }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="panel upcoming-panel">
      <div className="vital-card-label">Upcoming</div>
      <div className="upcoming-list">
        {rows.map((row) => (
          <div className="upcoming-item" key={row.id}>
            <div className="upcoming-item-date">
              <div className="upcoming-item-day">{formatDate(row.date)}</div>
              <div className="muted tiny">{relativeDueLabel(daysUntil(row.date))}</div>
            </div>
            <div className="upcoming-item-info">
              <div className="upcoming-item-payee">{payeesLabel(row)}</div>
              {row.group && <div className="muted tiny">{row.group}</div>}
            </div>
            <div className="upcoming-item-amount">{money(row.due)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
