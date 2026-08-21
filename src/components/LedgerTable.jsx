import React, { useEffect, useRef, useState } from "react";
import { payeesLabel } from "../lib/scheduleUtils.js";
import Receipt from "./Receipt.jsx";

const money = (n) => "K" + (Number(n) || 0).toLocaleString("en-ZM", { maximumFractionDigits: 0 });

export default function LedgerTable({
  rowsComputed,
  totals,
  isRecipientRow,
  onAddPayment,
  onVoidPayment,
  onEditPayment,
  onSetDueOverride,
  memberName,
  groupName,
  cycleName,
}) {
  // One receipt modal for the whole table (not per-row) — only one entry's
  // receipt is ever open at a time, and keeping it here means Receipt
  // isn't remounted/rebuilt as rows expand and collapse.
  const [receiptFor, setReceiptFor] = useState(null); // { payment, row } | null

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
              onEditPayment={onEditPayment}
              onSetDueOverride={onSetDueOverride}
              onViewReceipt={(payment) => setReceiptFor({ payment, row: r })}
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

      {receiptFor && (
        <Receipt
          payment={receiptFor.payment}
          scheduleRow={receiptFor.row}
          memberName={memberName}
          groupName={groupName}
          cycleName={cycleName}
          onClose={() => setReceiptFor(null)}
        />
      )}
    </div>
  );
}

function RowWithHistory({ row, isRecipient, onAddPayment, onVoidPayment, onEditPayment, onSetDueOverride, onViewReceipt }) {
  const [open, setOpen] = useState(false);
  const [editingDue, setEditingDue] = useState(false);
  const [dueDraft, setDueDraft] = useState(row.due);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  // A brief "✓ Logged" confirmation on the button itself, right where
  // the member's attention already is (rather than chasing the new
  // entry in the history list below, which might not even be in view).
  // Purely a UI confirmation — the payment already exists in row.entries
  // the moment this fires, this just makes success visible for a beat.
  const [justLogged, setJustLogged] = useState(false);
  const justLoggedTimeoutRef = useRef();
  useEffect(() => () => clearTimeout(justLoggedTimeoutRef.current), []);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [entryDraft, setEntryDraft] = useState("");
  const [entryBusy, setEntryBusy] = useState(false);

  const activeEntries = row.entries.filter((e) => !e.voidedAt);
  const voidedEntries = row.entries.filter((e) => e.voidedAt);

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return;
    setBusy(true);
    try {
      await onAddPayment(row.id, amount);
      setAmount("");
      setJustLogged(true);
      clearTimeout(justLoggedTimeoutRef.current);
      justLoggedTimeoutRef.current = setTimeout(() => setJustLogged(false), 1400);
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

  const startEditEntry = (entry) => {
    setEntryDraft(entry.amount);
    setEditingEntryId(entry.id);
  };

  const saveEntryEdit = async (entry) => {
    if (!entryDraft || Number(entryDraft) <= 0) return;
    setEntryBusy(true);
    try {
      await onEditPayment(entry.id, row.id, entryDraft);
      setEditingEntryId(null);
    } finally {
      setEntryBusy(false);
    }
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
                    {!e.voidedAt && editingEntryId === e.id ? (
                      <span className="due-edit">
                        <input
                          type="number"
                          className="cell-input"
                          value={entryDraft}
                          onChange={(ev) => setEntryDraft(ev.target.value)}
                          autoFocus
                        />
                        <button className="btn-link" disabled={entryBusy} onClick={() => saveEntryEdit(e)}>
                          {entryBusy ? "saving…" : "save"}
                        </button>
                        <button className="btn-link" disabled={entryBusy} onClick={() => setEditingEntryId(null)}>
                          cancel
                        </button>
                      </span>
                    ) : e.voidedAt ? (
                      <span>{money(e.amount)}</span>
                    ) : (
                      <button
                        className="link-amount"
                        onClick={() => startEditEntry(e)}
                        title="Edit this entry's amount"
                      >
                        {money(e.amount)}
                      </button>
                    )}
                    <span className="muted tiny">
                      {new Date(e.recordedAt).toLocaleDateString()} · {e.recordedBy}
                    </span>
                    {e.voidedAt ? (
                      <span className="muted tiny">voided</span>
                    ) : (
                      editingEntryId !== e.id && (
                        <>
                          {e.confirmedAt && (
                            <button className="receipt-link" onClick={() => onViewReceipt(e)}>🧾 Receipt</button>
                          )}
                          <button className="btn-link" onClick={() => onVoidPayment(e.id)}>void</button>
                        </>
                      )
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
                <button
                  className={"btn-ghost-dark" + (justLogged ? " btn-confirmed" : "")}
                  disabled={busy}
                  onClick={submit}
                >
                  {busy ? "Saving…" : justLogged ? "✓ Logged" : "+ Log payment"}
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
