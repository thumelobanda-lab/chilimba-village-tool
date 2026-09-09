import React from "react";
import { money } from "./LedgerTable.jsx";

function formatDate(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  if (isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-ZM", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * "Your Next Payments" — Date | Status | Amount, replacing the old
 * calendar-chip list (MyNextPayments.jsx). `rows` is myNextDueDates'
 * output (scheduleUtils.js): real schedule dates first, only
 * extrapolating ("Estimated") once those run out — see that function's
 * own doc comment for the forward-projection rules.
 */
export default function MyNextPaymentsTable({ rows }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="dashboard-stat-block">
      <div className="section-label-caps">Your Next Payments</div>
      <table className="dashboard-stat-table dashboard-stat-table-3col">
        <colgroup>
          <col style={{ width: "38%" }} />
          <col style={{ width: "32%" }} />
          <col style={{ width: "30%" }} />
        </colgroup>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.row?.id || `projected-${i}`}>
              <td>{formatDate(r.date)}</td>
              <td className="muted">{r.projected ? "Estimated" : "Scheduled"}</td>
              <td className="ar">{r.due != null ? money(r.due) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
