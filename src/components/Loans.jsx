import React, { useEffect, useState } from "react";
import { issueLoan, repayLoan, getGroupFunds } from "../lib/api.js";
import { useApiData } from "../lib/useApiData.js";

const money = (n) => "K" + (Number(n) || 0).toLocaleString("en-ZM", { maximumFractionDigits: 0 });

export default function Loans() {
  const { data, error: loadError, loading, refresh } = useApiData(getGroupFunds, []);
  const [fundId, setFundId] = useState("");
  const [borrowerName, setBorrowerName] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [status, setStatus] = useState("");

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

  const markRepaid = async (loanId) => {
    if (!window.confirm("Mark this loan as repaid? This returns the amount to the fund's available balance.")) return;
    await repayLoan(loanId);
    await refresh();
  };

  return (
    <div className="panel">
      <div className="setup-header">
        <h2 className="panel-title">Loans</h2>
        <span className="badge badge-admin">Admin only</span>
      </div>

      {loading && !data && <p className="muted small" aria-live="polite">Loading…</p>}
      {loadError && !data && <div className="error-text" role="alert">{loadError}</div>}

      {data && (loanableFunds.length === 0 ? (
        <p className="muted small">
          No fund is open for borrowing yet. Turn on "Members Can Borrow?" for a fund in Group Setup first.
        </p>
      ) : (
        <>
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
              <input value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} placeholder="e.g. Fridah" />
            </label>
            <label className="field">
              Amount (K)
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 100 }} />
            </label>
          </div>
          <label className="field">
            Notes (optional)
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. school fees, repay by next cycle" />
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
            <span className="muted small">{status}</span>
          </div>
        </>
      ))}

      {data && (
        <>
          <h3 className="panel-subtitle" style={{ marginTop: 20 }}>Loan history</h3>
          <div className="grid-wrap">
            <table className="grid-table">
          <thead>
            <tr>
              <th className="al">Borrower</th>
              <th className="al">Fund</th>
              <th className="ar">Amount (K)</th>
              <th className="al">Status</th>
              <th className="al">Issued</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(data?.loans || []).map((l) => (
              <tr key={l.id}>
                <td className="al">{l.borrowerName}</td>
                <td className="al muted">{l.fundName}</td>
                <td className="ar">{l.amount.toLocaleString()}</td>
                <td className="al">
                  {l.status === "outstanding" ? (
                    <span className="status-outstanding">Still Owed</span>
                  ) : (
                    <span className="status-paid">Repaid</span>
                  )}
                </td>
                <td className="al muted small">{new Date(l.issuedAt).toLocaleDateString()}</td>
                <td>
                  {l.status === "outstanding" && (
                    <button className="btn-link" onClick={() => markRepaid(l.id)}>mark repaid</button>
                  )}
                </td>
              </tr>
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
