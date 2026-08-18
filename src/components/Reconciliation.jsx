import React, { useState } from "react";
import { getReconciliation, confirmPayment, unconfirmPayment } from "../lib/api.js";
import { payeesLabel } from "../lib/scheduleUtils.js";
import { useApiData } from "../lib/useApiData.js";

const money = (n) => "K" + (Number(n) || 0).toLocaleString("en-ZM", { maximumFractionDigits: 0 });

export default function Reconciliation({ config }) {
  const upcoming = pickDefaultRow(config.schedule);
  const [rowId, setRowId] = useState(upcoming?.id || config.schedule[0]?.id);
  const [expanded, setExpanded] = useState(null); // one member's name at a time
  const [busyEntryId, setBusyEntryId] = useState(null);

  const { data, error, loading, refresh } = useApiData(
    () => (rowId ? getReconciliation(rowId) : Promise.resolve(null)),
    [rowId]
  );

  const toggleExpand = (name) => setExpanded(expanded === name ? null : name);

  const toggleConfirm = async (entry) => {
    setBusyEntryId(entry.id);
    try {
      if (entry.confirmedAt) {
        await unconfirmPayment({ paymentId: entry.id, memberName: entry.memberName });
      } else {
        await confirmPayment({ paymentId: entry.id, memberName: entry.memberName, scheduleRowId: rowId });
      }
      await refresh();
    } finally {
      setBusyEntryId(null);
    }
  };

  const exportCsv = () => {
    if (!data) return;
    const lines = [["Name", "Due (K)", "Paid (K)", "Balance (K)", "Status"]];
    data.members.forEach((m) => {
      lines.push([m.name, m.due, m.paid, m.balance, m.isRecipient ? "Recipient" : m.balance > 0 ? "Outstanding" : "Paid"]);
    });
    const csv = lines.map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reconciliation-${data.row.date.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totals = data
    ? data.members.reduce(
        (acc, m) => {
          acc.due += m.due;
          acc.paid += m.paid;
          if (m.balance > 0 && !m.isRecipient) acc.outstandingCount += 1;
          if (!m.isRecipient) acc.expectedCount += 1;
          return acc;
        },
        { due: 0, paid: 0, outstandingCount: 0, expectedCount: 0 }
      )
    : null;

  return (
    <div className="panel">
      <div className="setup-header">
        <h2 className="panel-title">Reconciliation</h2>
        <span className="badge badge-admin">Admin only</span>
      </div>

      <label className="field" style={{ maxWidth: 320 }}>
        Payout date
        <select value={rowId} onChange={(e) => setRowId(e.target.value)}>
          {config.schedule.map((r) => (
            <option key={r.id} value={r.id}>{r.date} — {r.group} ({payeesLabel(r)})</option>
          ))}
        </select>
      </label>

      {loading && <p className="muted small">Loading…</p>}
      {error && <div className="error-text">{error}</div>}

      {data && totals && (
        <>
          <div className="calc-grid" style={{ marginBottom: 18 }}>
            <SummaryCard label="Total Expected" value={money(totals.due)} />
            <SummaryCard label="Total Collected" value={money(totals.paid)} />
            <SummaryCard
              label="Still Outstanding"
              value={money(totals.due - totals.paid)}
              warn={totals.due - totals.paid > 0}
            />
            <SummaryCard
              label="Members Paid"
              value={`${totals.expectedCount - totals.outstandingCount} / ${totals.expectedCount}`}
            />
          </div>

          <div className="grid-wrap">
            <table className="grid-table">
              <thead>
                <tr>
                  <th className="al">Name</th>
                  <th className="ar">Due (K)</th>
                  <th className="ar">Paid (K)</th>
                  <th className="ar">Balance (K)</th>
                  <th className="al">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <React.Fragment key={m.name}>
                    <tr>
                      <td className="al">
                        {m.entries && m.entries.length > 0 ? (
                          <button className="link-amount" onClick={() => toggleExpand(m.name)} title="View payment entries">
                            {m.name} <span className="entry-count">({m.entries.length})</span>
                          </button>
                        ) : (
                          m.name
                        )}
                      </td>
                      <td className="ar">{m.due.toLocaleString()}</td>
                      <td className="ar">{m.paid.toLocaleString()}</td>
                      <td className={"ar " + (m.balance > 0 && !m.isRecipient ? "neg" : "pos")}>
                        {m.balance.toLocaleString()}
                      </td>
                      <td className="al">
                        {m.isRecipient ? (
                          <span className="tag">recipient</span>
                        ) : m.balance > 0 ? (
                          <span className="status-outstanding">Outstanding</span>
                        ) : (
                          <span className="status-paid">Paid</span>
                        )}
                        {m.entries && m.entries.length > 0 && m.entries.every((e) => e.confirmedAt) && (
                          <span className="confirm-bulb confirm-bulb-on" title="All entries confirmed">●</span>
                        )}
                      </td>
                    </tr>
                    {expanded === m.name && m.entries && (
                      <tr className="history-row">
                        <td colSpan={5}>
                          <div className="history-panel">
                            {m.entries.map((e) => (
                              <div key={e.id} className="history-entry">
                                <span
                                  className={"confirm-bulb " + (e.confirmedAt ? "confirm-bulb-on" : "confirm-bulb-off")}
                                  title={e.confirmedAt ? `Confirmed by ${e.confirmedBy}` : "Not yet confirmed"}
                                >●</span>
                                <span>{money(e.amount)}</span>
                                <span className="muted tiny">{new Date(e.recordedAt).toLocaleDateString()}</span>
                                <button
                                  className="btn-link"
                                  disabled={busyEntryId === e.id}
                                  onClick={() => toggleConfirm(e)}
                                >
                                  {e.confirmedAt ? "unconfirm" : "confirm"}
                                </button>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {data.members.length === 0 && (
                  <tr><td colSpan={5} className="muted small">No members have signed in yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <button className="btn-ghost-dark" style={{ marginTop: 14 }} onClick={exportCsv}>
            Export CSV
          </button>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, warn }) {
  return (
    <div className={"card" + (warn ? " card-warn" : "")}>
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
    </div>
  );
}

function pickDefaultRow(schedule) {
  const today = new Date();
  return schedule.find((r) => new Date(r.date) >= today) || schedule[schedule.length - 1];
}

function csvEscape(value) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
