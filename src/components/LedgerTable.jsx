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
  premiumActive,
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
            <th className="ar">Due (K)</th>
            <th className="ar">Paid (K)</th>
            <th className="ar">Balance (K)</th>
            <th className="ar">Total Paid So Far (K)</th>
            <th className="ar">Suggested (K)</th>
          </tr>
        </thead>
        <tbody>
          {rowsComputed.map((r) => (
            <RowWithHistory
              key={r.id}
              row={r}
              allRows={rowsComputed}
              isRecipient={isRecipientRow(r)}
              onAddPayment={onAddPayment}
              onVoidPayment={onVoidPayment}
              onEditPayment={onEditPayment}
              onSetDueOverride={onSetDueOverride}
              onViewReceipt={(payment) => setReceiptFor({ payment, row: r })}
              premiumActive={premiumActive}
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>TOTAL</td>
            <td className="ar" data-label="Due (K)">{totals.due.toLocaleString()}</td>
            <td className="ar" data-label="Paid (K)">{totals.paid.toLocaleString()}</td>
            <td className="ar" data-label="Balance (K)">{totals.balance.toLocaleString()}</td>
            <td className="ar"></td>
            <td className="ar" data-label="Suggested (K)">{Math.round(totals.suggestedTotal).toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>

      {totals.orphanedEntries && totals.orphanedEntries.length > 0 && (
        <OrphanedEntries
          entries={totals.orphanedEntries}
          allRows={rowsComputed}
          onVoidPayment={onVoidPayment}
          onEditPayment={onEditPayment}
        />
      )}

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

function RowWithHistory({ row, allRows, isRecipient, onAddPayment, onVoidPayment, onEditPayment, onSetDueOverride, onViewReceipt, premiumActive }) {
  const [open, setOpen] = useState(false);
  const [editingDue, setEditingDue] = useState(false);
  const [dueDraft, setDueDraft] = useState(row.due);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
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
  const [entryDateDraft, setEntryDateDraft] = useState(row.id);
  const [entryBusy, setEntryBusy] = useState(false);

  const activeEntries = row.entries.filter((e) => !e.voidedAt);
  const voidedEntries = row.entries.filter((e) => e.voidedAt);

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return;
    setBusy(true);
    try {
      await onAddPayment(row.id, amount, note);
      setAmount("");
      setNote("");
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
    setEntryDateDraft(row.id);
    setEditingEntryId(entry.id);
  };

  const saveEntryEdit = async (entry) => {
    if (!entryDraft || Number(entryDraft) <= 0) return;
    setEntryBusy(true);
    try {
      await onEditPayment(entry.id, entryDateDraft, entryDraft);
      setEditingEntryId(null);
    } finally {
      setEntryBusy(false);
    }
  };

  return (
    <>
      <tr>
        <td className="al" data-label="Payment Date">{row.date}</td>
        <td className="al muted" data-label="Group Paying Out">
          {row.group}
          <div className="tiny muted">{payeesLabel(row)}</div>
          {isRecipient && <span className="tag">your payout</span>}
        </td>
        <td className="ar" data-label="Due (K)">
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
        <td className="ar" data-label="Paid (K)">
          <button className="link-amount" onClick={() => setOpen(!open)} title="View payment entries">
            {row.paid.toLocaleString()}
            <span className="entry-count">{activeEntries.length ? ` (${activeEntries.length})` : ""}</span>
          </button>
        </td>
        <td className={"ar " + (row.balance > 0 ? "neg" : "pos")} data-label="Balance (K)">{row.balance.toLocaleString()}</td>
        <td className="ar muted" data-label="Total Paid So Far (K)">{row.cumulative.toLocaleString()}</td>
        <td className="ar" data-label="Suggested (K)">{Math.round(row.suggested).toLocaleString()}</td>
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
                  <div key={e.id} className="history-entry-wrap">
                    <div className={"history-entry" + (e.voidedAt ? " voided" : "")}>
                      {!e.voidedAt && <span className={"confirm-bulb " + bulbClass(e)} title={bulbTitle(e)}>●</span>}
                      {!e.voidedAt && editingEntryId === e.id ? (
                        <span className="due-edit">
                          <input
                            type="number"
                            className="cell-input"
                            value={entryDraft}
                            onChange={(ev) => setEntryDraft(ev.target.value)}
                            autoFocus
                          />
                          {allRows && allRows.length > 1 && (
                            <select
                              className="cell-input"
                              value={entryDateDraft}
                              onChange={(ev) => setEntryDateDraft(ev.target.value)}
                              title="Logged against the wrong date? Move it here."
                            >
                              {allRows.map((r) => (
                                <option key={r.id} value={r.id}>{r.date}</option>
                              ))}
                            </select>
                          )}
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
                            {/* Receipts are a premium feature — see FreeTierBanner.jsx */}
                            {e.confirmedAt && premiumActive && (
                              <button className="receipt-link" onClick={() => onViewReceipt(e)}>🧾 Receipt</button>
                            )}
                            <button className="btn-link" onClick={() => onVoidPayment(e.id)}>void</button>
                          </>
                        )
                      )}
                    </div>
                    {!e.voidedAt && e.confirmedAt && e.communityFundAmount > 0 && (
                      <div className="muted tiny split-breakdown">
                        {money(e.amount)} paid → {money(e.communityFundAmount)} to Group Savings Fund,{" "}
                        {money(e.amount - e.communityFundAmount)} to contribution
                      </div>
                    )}
                    {!e.voidedAt && e.confirmedAt && e.latePenaltyAmount > 0 && (
                      <div className="muted tiny split-breakdown">
                        ⏱ {money(e.latePenaltyAmount)} late penalty — added to Group Savings Fund
                      </div>
                    )}
                    {!e.voidedAt && e.note && (
                      <div className="muted tiny">Note: {e.note}</div>
                    )}
                    {!e.voidedAt && e.rejectedAt && (
                      <div className="muted tiny rejected-reason">
                        Not confirmed by {e.rejectedBy}{e.rejectionReason ? `: ${e.rejectionReason}` : "."}
                      </div>
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
                <input
                  type="text"
                  placeholder="Note or reference (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
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
              <p className="muted tiny" style={{ marginTop: 4 }}>
                A logged payment is pending until a group leader confirms it — you'll see the dot
                turn green once it's checked.
              </p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// A payment logged against a date that's since been removed from the
// schedule (see computeLedgerTotals in ledgerMath.js) — still counted
// toward `paid`, but with no row left to nest under, so it gets its own
// small section, dated by when it was actually logged since there's no
// due date left to show it against. "Move to a date" is the fix: pick a
// real current schedule date and it re-joins the ledger table properly.
function OrphanedEntries({ entries, allRows, onVoidPayment, onEditPayment }) {
  const [editingId, setEditingId] = useState(null);
  const [amountDraft, setAmountDraft] = useState("");
  const [dateDraft, setDateDraft] = useState(allRows[0]?.id || "");
  const [busy, setBusy] = useState(false);

  const startEdit = (entry) => {
    setAmountDraft(entry.amount);
    setDateDraft(allRows[0]?.id || "");
    setEditingId(entry.id);
  };

  const saveEdit = async (entry) => {
    if (!amountDraft || Number(amountDraft) <= 0 || !dateDraft) return;
    setBusy(true);
    try {
      await onEditPayment(entry.id, dateDraft, amountDraft);
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel" style={{ marginTop: 14 }}>
      <h3 className="panel-subtitle">Payments logged for a removed date</h3>
      <p className="muted tiny" style={{ marginBottom: 10 }}>
        These still count toward what you've paid — the payout date they were logged against
        was later removed from the schedule. Move each one to a real date to fully resolve it.
      </p>
      {entries.map((e) => (
        <div key={e.id} className="history-entry-wrap">
          <div className="history-entry">
            {editingId === e.id ? (
              <span className="due-edit">
                <input
                  type="number"
                  className="cell-input"
                  value={amountDraft}
                  onChange={(ev) => setAmountDraft(ev.target.value)}
                  autoFocus
                />
                {allRows.length > 0 && (
                  <select className="cell-input" value={dateDraft} onChange={(ev) => setDateDraft(ev.target.value)}>
                    {allRows.map((r) => (
                      <option key={r.id} value={r.id}>{r.date}</option>
                    ))}
                  </select>
                )}
                <button className="btn-link" disabled={busy} onClick={() => saveEdit(e)}>
                  {busy ? "saving…" : "save"}
                </button>
                <button className="btn-link" disabled={busy} onClick={() => setEditingId(null)}>cancel</button>
              </span>
            ) : (
              <button className="link-amount" onClick={() => startEdit(e)} title="Move this entry to a current date">
                {money(e.amount)}
              </button>
            )}
            <span className="muted tiny">
              Logged {new Date(e.recordedAt).toLocaleDateString()} · {e.recordedBy}
            </span>
            {editingId !== e.id && (
              <button className="btn-link" onClick={() => onVoidPayment(e.id)}>void</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Three visible states for a non-voided entry's bulb: green once an admin
// has confirmed it, amber while it's still a pending, member-submitted
// entry awaiting review (see addPayment in contributions.js), red if it
// was rejected. Anything else (status null — logged before the pending
// flow existed) reads as the original grey "not yet confirmed" — still
// counts fully, just unverified.
function bulbClass(entry) {
  if (entry.confirmedAt) return "confirm-bulb-on";
  if (entry.rejectedAt) return "confirm-bulb-rejected";
  if (entry.status === "pending") return "confirm-bulb-pending";
  return "confirm-bulb-off";
}

function bulbTitle(entry) {
  if (entry.confirmedAt) return `Confirmed by a group leader (${entry.confirmedBy})`;
  if (entry.rejectedAt) return `Not confirmed by ${entry.rejectedBy}${entry.rejectionReason ? `: ${entry.rejectionReason}` : ""}`;
  if (entry.status === "pending") return "Pending — awaiting group leader review";
  return "Not yet confirmed by a group leader";
}

export { money };
