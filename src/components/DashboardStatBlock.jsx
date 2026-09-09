import React from "react";

/**
 * A labeled block of right-aligned label/value rows — "Your Money" and
 * "The Group" on the dashboard's lower, tabular section both use this
 * same shape (see Dashboard.jsx). table-layout: fixed with an explicit
 * label-column width so a longer label (e.g. "Members paid this week")
 * never truncates the way free-width columns did before this.
 */
export default function DashboardStatBlock({ title, rows }) {
  return (
    <div className="dashboard-stat-block">
      <div className="section-label-caps">{title}</div>
      <table className="dashboard-stat-table">
        <colgroup>
          <col style={{ width: "62%" }} />
          <col style={{ width: "38%" }} />
        </colgroup>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td className={"ar" + (r.warn ? " neg" : r.ok ? " pos" : "")}>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
