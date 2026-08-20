import React, { useState } from "react";
import { buildProjectionSchedule } from "../lib/interestMath.js";

const money = (n) => "K" + (Number(n) || 0).toLocaleString("en-ZM", { maximumFractionDigits: 0 });

function monthsLabel(m) {
  if (m % 12 === 0) return `${m / 12} yr${m === 12 ? "" : "s"}`;
  return `${m} mo`;
}

/**
 * A forward-looking "what if this fund earned interest" projection —
 * display only. Deliberately never calls a fund/ledger-mutating API; it
 * only reads `fundTotal`, which the caller (Community.jsx) already
 * fetched, and does client-side arithmetic from there. Nothing here
 * changes what the community fund actually holds.
 */
export default function GrowthProjection({ fundTotal }) {
  const [rate, setRate] = useState(10);

  const schedule = buildProjectionSchedule(fundTotal, rate);

  return (
    <div style={{ marginTop: 24, marginBottom: 20 }}>
      <h3 className="panel-subtitle">📈 Growth Projection</h3>
      <p className="muted tiny" style={{ marginBottom: 10 }}>
        A projection only — this does not add interest to the fund or change any balance.
        It's simple interest (not compounded) on today's fund total of {money(fundTotal)}, for
        planning purposes.
      </p>

      <label className="field" style={{ maxWidth: 200 }}>
        Annual rate (%)
        <input
          type="number"
          min="0"
          step="0.5"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
      </label>

      <div className="grid-wrap" style={{ marginTop: 10 }}>
        <table className="grid-table">
          <thead>
            <tr>
              <th className="al">In</th>
              <th className="ar">Projected Interest</th>
              <th className="ar">Projected Total</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((p) => (
              <tr key={p.months}>
                <td className="al">{monthsLabel(p.months)}</td>
                <td className="ar muted">{money(p.interest)}</td>
                <td className="ar">{money(p.projectedTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
