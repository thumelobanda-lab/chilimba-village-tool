import React, { useState } from "react";
import { payeesLabel } from "../lib/scheduleUtils.js";

const money = (n) => "K" + (Number(n) || 0).toLocaleString("en-ZM", { maximumFractionDigits: 0 });

export default function LedgerTable({ rowsComputed, totals, isRecipientRow, onAddPayment, onVoidPayment, onSetDueOverride }) {
  return (
    <div className="grid-wrap">
      <table className="grid-table">
        <thead>
          <tr>
            <th className="al">Payment Date</th>
            <th className="al">Group Paying Out</th>
            <th className="ar">Amount Due (K)</th>
            <th className="ar">Amount Paid (K)</th>
            <th className="ar">Balance (K)</th>
            <th className="ar">Cumulative Paid (K)</th>
            <th className="ar">Suggested (K)</th>
          </tr>
        </thead>
        <tbody>
          {rowsComputed.map((r) => (
            <RowWithHistory
              key={r.id}
              row={r}
              isRecipient={isRecipientRow(r)}
              onAddPayment={onAddPayment}
              onVoidPayment={onVoidPayment}
              onSetDueOverride={onSetDueOverride}
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>TOTAL</td>
            <td className="ar">{totals.due.toLocaleString()}</td>
            <td className="ar">{totals.paid.toLocaleString()}</td>
            <td className="ar">{totals.balance.toLocaleString()}</td>
            <td className="ar"></td>
            <td className="ar">{Math.round(totals.suggestedTotal).toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function RowWithHistory({ row, isRecipient, onAddPayment, onVoidPayment, onSetDueOverride }) {
  const [open, setOpen] = useState(false);
  const [editingDue, setEditingDue] = useState(false);
  const [dueDraft, setDueDraft] = useState(row.due);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const activeEntries = row.entries.filter((e) => !e.voidedAt);
  const voidedEntries = row.entries.filter((e) => e.voidedAt);

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return;
    setBusy(true);
    try {
      await onAddPayment(row.id, amount);
      setAmount("");
    } finally {
      setBusy(false);
    }
  };

  const saveDue = async () => {
    await onSetDueOverride(row.id, dueDraft);
    setEditingDue(false);
  };

  const resetDue = async () => {
    await onSetDueOverride(row.id, null);
    setEditingDue(false);
  };

  return (
    <>
      <tr>
        <td className="al">{row.date}</td>
        <td className="al muted">
          {row.group}
          <div className="tiny muted">{payeesLabel(row)}</div>
          {isRecipient && <span className="tag">your payout</span>}
        </td>
        <td className="ar">
          {isRecipient ? (
            row.due.toLocaleString()
          ) : editingDue ? (
            <span className="due-edit">
              <input
                type="number"
                className="cell-input"
                value={dueDraft}
                onChange={(e) => setDueDraft(e.target.value)}
              />
              <button className="btn-link" onClick={saveDue}>save</button>
              {row.overridden && <button className="btn-link" onClick={resetDue}>use default</button>}
            </span>
          ) : (
            <button
              className="link-amount"
              onClick={() => { setDueDraft(row.due); setEditingDue(true); }}
              title="Set your own agreed rate for this date"
            >
              {row.due.toLocaleString()}
              {row.overridden && <span className="tag tag-rate">your rate</span>}
            </button>
          )}
        </td>
        <td className="ar">
          <button className="link-amount" onClick={() => setOpen(!open)} title="View payment entries">
            {row.paid.toLocaleString()}
            <span className="entry-count">{activeEntries.length ? ` (${activeEntries.length})` : ""}</span>
          </button>
        </td>
        <td className={"ar " + (row.balance > 0 ? "neg" : "pos")}>{row.balance.toLocaleString()}</td>
        <td className="ar muted">{row.cumulative.toLocaleString()}</td>
        <td className="ar">{Math.round(row.suggested).toLocaleString()}</td>
      </tr>
      {open && (
        <tr className="history-row">
          <td colSpan={7}>
            <div className="history-panel">
              {activeEntries.length === 0 && voidedEntries.length === 0 && (
                <p className="muted tiny">No payments logged for this date yet.</p>
              )}
              {[...activeEntries, ...voidedEntries]
                .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))
                .map((e) => (
                  <div key={e.id} className={"history-entry" + (e.voidedAt ? " voided" : "")}>
                    {!e.voidedAt && (
                      <span
                        className={"confirm-bulb " + (e.confirmedAt ? "confirm-bulb-on" : "confirm-bulb-off")}
                        title={e.confirmedAt ? `Confirmed by an admin (${e.confirmedBy})` : "Not yet confirmed by an admin"}
                      >●</span>
                    )}
                    <span>{money(e.amount)}</span>
                    <span className="muted tiny">
                      {new Date(e.recordedAt).toLocaleDateString()} · {e.recordedBy}
                    </span>
                    {e.voidedAt ? (
                      <span className="muted tiny">voided</span>
                    ) : (
                      <button className="btn-link" onClick={() => onVoidPayment(e.id)}>void</button>
                    )}
                  </div>
                ))}

              <div className="history-add">
                <input
                  type="number"
                  placeholder="Amount (K)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="cell-input"
                />
                <button className="btn-ghost-dark" disabled={busy} onClick={submit}>
                  {busy ? "Saving…" : "+ Log payment"}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export { money };
