import React, { useState } from "react";
import { saveSchedule } from "../lib/api.js";
import { getPayees } from "../lib/scheduleUtils.js";
import AdminManagement from "./AdminManagement.jsx";

export default function GroupSetup({ config, onSaved }) {
  const [draft, setDraft] = useState(() => {
    const cloned = JSON.parse(JSON.stringify(config));
    cloned.schedule = cloned.schedule.map((r) => ({
      ...r,
      payeesText: getPayees(r).join(", "),
    }));
    return cloned;
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const editRow = (id, field, value) => {
    setDraft({
      ...draft,
      schedule: draft.schedule.map((r) =>
        r.id === id ? { ...r, [field]: field === "due" ? Number(value) || 0 : value } : r
      ),
    });
  };

  const addRow = () => {
    const n = draft.schedule.length + 1;
    setDraft({
      ...draft,
      schedule: [
        ...draft.schedule,
        { id: "d" + Date.now(), date: "", group: `GROUP ${n}`, payeesText: "", due: draft.schedule.at(-1)?.due || 1700 },
      ],
    });
  };

  const removeRow = (id) => {
    setDraft({ ...draft, schedule: draft.schedule.filter((r) => r.id !== id) });
  };

  const editFund = (id, field, value) => {
    setDraft({
      ...draft,
      funds: (draft.funds || []).map((f) =>
        f.id === id ? { ...f, [field]: field === "amount" ? Number(value) || 0 : value } : f
      ),
    });
  };

  const addFund = () => {
    setDraft({
      ...draft,
      funds: [...(draft.funds || []), { id: "fund" + Date.now(), name: "", amount: 0 }],
    });
  };

  const removeFund = (id) => {
    setDraft({ ...draft, funds: (draft.funds || []).filter((f) => f.id !== id) });
  };

  const save = async () => {
    setError("");
    setStatus("Saving…");
    try {
      const toSave = {
        ...draft,
        schedule: draft.schedule.map(({ payeesText, payee, ...r }) => ({
          ...r,
          payees: (payeesText || "")
            .split(/[,/]/)
            .map((s) => s.trim())
            .filter(Boolean),
        })),
      };
      if (toSave.schedule.some((r) => r.payees.length === 0)) {
        throw new Error("Every date needs at least one recipient.");
      }
      if (toSave.schedule.some((r) => r.payees.length > 3)) {
        throw new Error("A date can have at most 3 recipients.");
      }
      if ((toSave.funds || []).some((f) => !f.name.trim())) {
        throw new Error("Every fund needs a name.");
      }
      await saveSchedule(toSave);
      onSaved(toSave);
      setStatus("Saved");
    } catch (e) {
      setError(e.message);
      setStatus("");
    } finally {
      setTimeout(() => setStatus(""), 1500);
    }
  };

  return (
    <div className="panel">
      <div className="setup-header">
        <h2 className="panel-title">Group Setup</h2>
        <span className="badge badge-admin">Admin only</span>
      </div>

      <div className="field-row">
        <label className="field">
          Group name
          <input value={draft.groupName} onChange={(e) => setDraft({ ...draft, groupName: e.target.value })} />
        </label>
        <label className="field">
          Cycle name
          <input value={draft.cycleName} onChange={(e) => setDraft({ ...draft, cycleName: e.target.value })} />
        </label>
        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={draft.recipientExempt}
            onChange={(e) => setDraft({ ...draft, recipientExempt: e.target.checked })}
          />
          Recipient pays K0 on their own payout date
        </label>
      </div>

      <div className="grid-wrap">
        <table className="grid-table">
          <thead>
            <tr>
              <th className="al">Date</th>
              <th className="al">Group</th>
              <th className="al">Recipient(s) — 1 to 3 names, comma-separated</th>
              <th className="ar">Due (K)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {draft.schedule.map((r) => (
              <tr key={r.id}>
                <td><input className="cell-input-text" value={r.date} onChange={(e) => editRow(r.id, "date", e.target.value)} /></td>
                <td><input className="cell-input-text" value={r.group} onChange={(e) => editRow(r.id, "group", e.target.value)} /></td>
                <td>
                  <input
                    className="cell-input-text wide"
                    value={r.payeesText}
                    onChange={(e) => editRow(r.id, "payeesText", e.target.value)}
                    placeholder="e.g. Doreen, Dorothy, Fridah"
                  />
                </td>
                <td className="ar"><input type="number" className="cell-input" value={r.due} onChange={(e) => editRow(r.id, "due", e.target.value)} /></td>
                <td><button className="btn-icon" onClick={() => removeRow(r.id)} title="Remove row" aria-label={`Remove ${r.date || "this"} date`}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="panel-subtitle" style={{ marginTop: 20 }}>Community Funds</h3>
      <p className="muted tiny" style={{ marginBottom: 10 }}>
        A fixed amount is set aside from each member's contribution once they've paid their
        due amount for a date. Visible to every member — see the "Community" tab.
      </p>
      <div className="grid-wrap">
        <table className="grid-table">
          <thead>
            <tr>
              <th className="al">Fund name</th>
              <th className="ar">Amount per date (K)</th>
              <th className="al">Loanable</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(draft.funds || []).map((f) => (
              <tr key={f.id}>
                <td><input className="cell-input-text wide" value={f.name} onChange={(e) => editFund(f.id, "name", e.target.value)} placeholder="e.g. Future Sharing Fund" /></td>
                <td className="ar"><input type="number" className="cell-input" value={f.amount} onChange={(e) => editFund(f.id, "amount", e.target.value)} /></td>
                <td>
                  <input
                    type="checkbox"
                    checked={!!f.loanable}
                    onChange={(e) => editFund(f.id, "loanable", e.target.checked)}
                  />
                </td>
                <td><button className="btn-icon" onClick={() => removeFund(f.id)} title="Remove fund" aria-label={`Remove ${f.name || "this"} fund`}>✕</button></td>
              </tr>
            ))}
            {(!draft.funds || draft.funds.length === 0) && (
              <tr><td colSpan={4} className="muted small">No community funds set up.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <button className="btn-ghost-dark" style={{ marginTop: 10 }} onClick={addFund}>+ Add fund</button>

      {error && <div className="error-text">{error}</div>}

      <div className="field-row" style={{ marginTop: 14 }}>
        <button className="btn-ghost-dark" onClick={addRow}>+ Add date</button>
        <button className="btn-primary" style={{ width: "auto" }} onClick={save}>Save Group Settings</button>
        <span className="muted small">{status}</span>
      </div>

      <p className="muted tiny" style={{ marginTop: 12 }}>
        Changes apply for every member using this ledger.
      </p>

      <AdminManagement />
    </div>
  );
}
