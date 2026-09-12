import React, { useEffect, useState } from "react";
import { issueLoan, repayLoan, editLoan, voidRepayment, getGroupFunds } from "../lib/api.js";
import { useApiData } from "../lib/useApiData.js";
import { useMemberRoster } from "../hooks/useMemberRoster.js";
import Toast from "./Toast.jsx";
import Icon from "./Icon.jsx";

const money = (n) => "K" + (Number(n) || 0).toLocaleString("en-ZM", { maximumFractionDigits: 0 });

export default function Loans() {
  const { data, error: loadError, loading, refresh } = useApiData(getGroupFunds, []);
  // Suggestions, not a hard-enforced select — a loan can legitimately go
  // to someone outside the regular member roster (e.g. a relative
  // covering a member's slot), so this autocompletes against real
  // members without blocking a name that isn't one.
  const { members: roster } = useMemberRoster();
  const [fundId, setFundId] = useState("");
  const [borrowerName, setBorrowerName] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [status, setStatus] = useState("");
  const [expanded, setExpanded] = useState(null); // one loan's id at a time
  const [repayDrafts, setRepayDrafts] = useState({}); // { [loanId]: "amount typed" }
  const [repayBusyId, setRepayBusyId] = useState(null);
  const [repayError, setRepayError] = useState("");
  const [editingLoanId, setEditingLoanId] = useState(null);
  const [editDraft, setEditDraft] = useState({ amount: "", borrowerName: "" });
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const [voidBusyId, setVoidBusyId] = useState(null);

  useEffect(() => {
    if (data && !fundId) {
      const firstLoanable = data.funds.find((f) => f.loanable);
      if (firstLoanable) setFundId(firstLoanable.id);
    }
  }, [data, fundId]);

  const loanableFunds = data?.funds.filter((f) => f.loanable) || [];
  const selectedFund = loanableFunds.find((f) => f.id === fundId);

  const submit = async () => {
    setFormError("");
    if (!fundId || !borrowerName.trim() || !amount) {
      setFormError("Fill in the fund, borrower, and amount.");
      return;
    }
    setBusy(true);
    try {
      await issueLoan({ fundId, borrowerName: borrowerName.trim(), amount, notes });
      setBorrowerName("");
      setAmount("");
      setNotes("");
      setStatus("Loan issued");
      await refresh();
    } catch (e) {
      setFormError(e.message || "Could not issue the loan.");
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(""), 1500);
    }
  };

  const toggleExpand = (loanId) => setExpanded(expanded === loanId ? null : loanId);

  const submitRepayment = async (loan) => {
    const draft = repayDrafts[loan.id];
    const amt = Number(draft);
    setRepayError("");
    if (!draft || !amt || amt <= 0) {
      setRepayError("Enter an amount greater than zero.");
      return;
    }
    setRepayBusyId(loan.id);
    try {
      await repayLoan(loan.id, amt);
      setRepayDrafts((prev) => ({ ...prev, [loan.id]: "" }));
      await refresh();
    } catch (e) {
      setRepayError(e.message || "Could not record that repayment.");
    } finally {
      setRepayBusyId(null);
    }
  };

  const startEditLoan = (loan) => {
    setEditError("");
    setEditDraft({ amount: loan.amount, borrowerName: loan.borrowerName });
    setEditingLoanId(loan.id);
    setExpanded(loan.id);
  };

  const saveEditLoan = async (loan) => {
    setEditError("");
    setEditBusy(true);
    try {
      await editLoan(loan.id, { amount: editDraft.amount, borrowerName: editDraft.borrowerName });
      setEditingLoanId(null);
      await refresh();
    } catch (e) {
      setEditError(e.message || "Could not save that correction.");
    } finally {
      setEditBusy(false);
    }
  };

  const removeRepayment = async (loan, repayment) => {
    if (!window.confirm(`Void the ${money(repayment.amount)} repayment recorded on ${new Date(repayment.recordedAt).toLocaleDateString()}? It'll stay visible, struck through, for the record.`)) return;
    setVoidBusyId(repayment.id);
    try {
      await voidRepayment(loan.id, repayment.id);
      await refresh();
    } catch (e) {
      setRepayError(e.message || "Could not void that repayment.");
    } finally {
      setVoidBusyId(null);
    }
  };

  return (
    <div className="panel">
      <div className="setup-header">
        <h2 className="panel-title">Loans</h2>
        <span className="badge badge-admin">Group Leader only</span>
      </div>

      {loading && !data && <p className="muted small" aria-live="polite">Loading…</p>}
      {loadError && !data && <div className="error-text" role="alert">{loadError}</div>}

      {data && (loanableFunds.length === 0 ? (
        <p className="muted small">
          No fund is open for borrowing yet. Turn on "Members Can Borrow?" for a fund in Group Setup first.
        </p>
      ) : (
        <>
          <h3 className="panel-subtitle">Issue a Loan</h3>
          <div className="field-row" style={{ alignItems: "flex-end" }}>
            <label className="field">
              Fund
              <select value={fundId} onChange={(e) => setFundId(e.target.value)}>
                {loanableFunds.map((f) => (
                  <option key={f.id} value={f.id}>{f.name} — {money(f.available)} available</option>
                ))}
              </select>
            </label>
            <label className="field">
              Borrower name
              <input
                value={borrowerName}
                onChange={(e) => setBorrowerName(e.target.value)}
                placeholder="e.g. Fridah"
                list="loan-borrower-roster"
              />
              <datalist id="loan-borrower-roster">
                {roster.map((m) => <option key={m.name} value={m.name} />)}
              </datalist>
            </label>
            <label className="field">
              Amount (K)
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 100 }} />
            </label>
          </div>
          <label className="field">
            Notes (optional)
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. school fees, repay by next round" />
          </label>

          {selectedFund && (
            <p className="muted tiny">
              {selectedFund.name}: {money(selectedFund.balance)} collected, {money(selectedFund.outstandingLoans)} out on loan,
              {" "}{money(selectedFund.available)} available to lend.
            </p>
          )}

          {formError && <div className="error-text">{formError}</div>}

          <div className="field-row">
            <button className="btn-primary" style={{ width: "auto" }} disabled={busy} onClick={submit}>
              {busy ? "Issuing…" : "Issue loan"}
            </button>
          </div>
          <Toast message={status} />
        </>
      ))}

      {data && (
        <>
          <h3 className="panel-subtitle" style={{ marginTop: 20 }}>Loan history</h3>
          <p className="muted tiny" style={{ marginBottom: 10 }}>
            Tap a borrower's name to see every repayment logged against their loan, or record a new one —
            partial repayments are fine, the balance just goes down each time.
          </p>
          <div className="grid-wrap">
            <table className="grid-table">
          <thead>
            <tr>
              <th className="al">Borrower</th>
              <th className="al">Fund</th>
              <th className="ar">Borrowed (K)</th>
              <th className="ar">Balance (K)</th>
              <th className="al">Status</th>
              <th className="al">Issued</th>
            </tr>
          </thead>
          <tbody>
            {(data?.loans || []).map((l) => (
              <React.Fragment key={l.id}>
                <tr>
                  <td className="al" data-label="Borrower">
                    <button className="link-amount" onClick={() => toggleExpand(l.id)} title="View repayment history">
                      {l.borrowerName}
                      {l.repayments && l.repayments.length > 0 && <span className="entry-count"> ({l.repayments.length})</span>}
                    </button>
                  </td>
                  <td className="al muted" data-label="Fund">{l.fundName}</td>
                  <td className="ar" data-label="Borrowed (K)">{l.amount.toLocaleString()}</td>
                  <td className="ar" data-label="Balance (K)">{(l.balance ?? l.amount).toLocaleString()}</td>
                  <td className="al" data-label="Status">
                    {l.status === "outstanding" ? (
                      <span className="status-outstanding">Still Owed</span>
                    ) : (
                      <span className="status-paid">Repaid</span>
                    )}
                  </td>
                  <td className="al muted small" data-label="Issued">
                    {new Date(l.issuedAt).toLocaleDateString()}
                    <button className="btn-link tiny" style={{ marginLeft: 6 }} onClick={() => startEditLoan(l)} title="Correct the amount or borrower name">
                      <Icon name="edit" size={12} className="icon-inline" /> edit
                    </button>
                  </td>
                </tr>
                {expanded === l.id && (
                  <tr className="history-row">
                    <td colSpan={6}>
                      <div className="history-panel">
                        {editingLoanId === l.id && (
                          <div className="history-add" style={{ marginBottom: 10 }}>
                            <input
                              type="text"
                              placeholder="Borrower name"
                              value={editDraft.borrowerName}
                              onChange={(e) => setEditDraft((d) => ({ ...d, borrowerName: e.target.value }))}
                              className="cell-input"
                              list="loan-borrower-roster"
                            />
                            <input
                              type="number"
                              placeholder="Amount (K)"
                              value={editDraft.amount}
                              onChange={(e) => setEditDraft((d) => ({ ...d, amount: e.target.value }))}
                              className="cell-input"
                            />
                            <button className="btn-ghost-dark" disabled={editBusy} onClick={() => saveEditLoan(l)}>
                              {editBusy ? "Saving…" : "Save"}
                            </button>
                            <button className="btn-link" disabled={editBusy} onClick={() => setEditingLoanId(null)}>
                              cancel
                            </button>
                            {editError && <div className="error-text tiny">{editError}</div>}
                          </div>
                        )}

                        {(l.repayments || []).length === 0 && (
                          <p className="muted tiny">No repayments logged yet.</p>
                        )}
                        {(l.repayments || []).map((r) => (
                          <div key={r.id} className="history-entry-wrap">
                            <div className={"history-entry" + (r.voidedAt ? " voided" : "")}>
                              <span>{money(r.amount)}</span>
                              <span className="muted tiny">
                                {new Date(r.recordedAt).toLocaleDateString()} · {r.recordedBy}
                              </span>
                              {r.voidedAt ? (
                                <span className="muted tiny">voided</span>
                              ) : (
                                <button
                                  className="btn-link"
                                  disabled={voidBusyId === r.id}
                                  onClick={() => removeRepayment(l, r)}
                                  title="Void this repayment entry"
                                >
                                  {voidBusyId === r.id ? "voiding…" : "void"}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                        {(l.edits || []).length > 0 && (
                          <>
                            <p className="muted tiny" style={{ margin: "10px 0 4px" }}>Correction history</p>
                            {l.edits.map((e) => (
                              <div key={e.id} className="muted tiny">
                                Was {e.previousBorrowerName} · {money(e.previousAmount)} — corrected by {e.editedBy}, {new Date(e.editedAt).toLocaleDateString()}
                              </div>
                            ))}
                          </>
                        )}

                        {l.status === "outstanding" && (
                          <div className="history-add">
                            <input
                              type="number"
                              placeholder="Repayment amount (K)"
                              value={repayDrafts[l.id] || ""}
                              onChange={(e) => setRepayDrafts((prev) => ({ ...prev, [l.id]: e.target.value }))}
                              className="cell-input"
                            />
                            <button
                              className="btn-ghost-dark"
                              disabled={repayBusyId === l.id}
                              onClick={() => submitRepayment(l)}
                            >
                              {repayBusyId === l.id ? "Recording…" : "Record repayment"}
                            </button>
                          </div>
                        )}
                        {repayError && expanded === l.id && <div className="error-text tiny">{repayError}</div>}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {(!data || data.loans.length === 0) && (
              <tr><td colSpan={6} className="muted small">No loans issued yet.</td></tr>
            )}
          </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
