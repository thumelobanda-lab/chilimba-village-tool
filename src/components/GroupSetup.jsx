import React, { useState } from "react";
import { saveSchedule } from "../lib/api.js";
import { getPayees, generateScheduleDates, SCHEDULE_FREQUENCIES } from "../lib/scheduleUtils.js";
import AdminManagement from "./AdminManagement.jsx";
import CollapsibleSection from "./CollapsibleSection.jsx";
import InviteCard from "./InviteCard.jsx";

export default function GroupSetup({ config, onSaved, session }) {
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

  const [missingRecipientIds, setMissingRecipientIds] = useState([]);
  const [genFrequency, setGenFrequency] = useState("biweekly");
  const [genStartDate, setGenStartDate] = useState("");
  const [genCount, setGenCount] = useState(10);
  const [genError, setGenError] = useState("");

  const generateDates = () => {
    setGenError("");
    if (!genStartDate) {
      setGenError("Pick a start date first.");
      return;
    }
    const count = Number(genCount);
    if (!Number.isFinite(count) || count < 1 || count > 60) {
      setGenError("Enter a number of dates between 1 and 60.");
      return;
    }
    const dates = generateScheduleDates(genFrequency, genStartDate, count);
    const startIndex = draft.schedule.length;
    const defaultDue = draft.schedule.at(-1)?.due || 1700;
    const newRows = dates.map((d, i) => ({
      id: "d" + Date.now() + i,
      date: d,
      group: `GROUP ${startIndex + i + 1}`,
      payeesText: "",
      due: defaultDue,
    }));
    setDraft({ ...draft, schedule: [...draft.schedule, ...newRows] });
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

  const editPaymentMethod = (id, field, value) => {
    setDraft({
      ...draft,
      paymentMethods: (draft.paymentMethods || []).map((m) =>
        m.id === id ? { ...m, [field]: value } : m
      ),
    });
  };

  const addPaymentMethod = () => {
    setDraft({
      ...draft,
      paymentMethods: [
        ...(draft.paymentMethods || []),
        { id: "pay" + Date.now(), type: "mobile", label: "", accountName: "", accountNumber: "" },
      ],
    });
  };

  const removePaymentMethod = (id) => {
    setDraft({ ...draft, paymentMethods: (draft.paymentMethods || []).filter((m) => m.id !== id) });
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
      // Name the actual offending date(s), not just "something's wrong" —
      // with the Generate Payout Dates tool creating many empty rows at
      // once, "every date needs a recipient" alone gives no way to find
      // the one row that got missed on a long table.
      const missingRecipient = toSave.schedule.filter((r) => r.payees.length === 0);
      if (missingRecipient.length > 0) {
        setMissingRecipientIds(missingRecipient.map((r) => r.id));
        const list = missingRecipient.map((r) => r.date || r.group || "an unlabeled date").join(", ");
        throw new Error(`Missing a recipient for: ${list}. Every date needs at least one.`);
      }
      setMissingRecipientIds([]);
      const tooManyRecipients = toSave.schedule.filter((r) => r.payees.length > 3);
      if (tooManyRecipients.length > 0) {
        const list = tooManyRecipients.map((r) => r.date || r.group || "an unlabeled date").join(", ");
        throw new Error(`Too many recipients for: ${list}. A date can have at most 3.`);
      }
      if ((toSave.funds || []).some((f) => !f.name.trim())) {
        throw new Error("Every fund needs a name.");
      }
      if ((toSave.paymentMethods || []).some((m) => !m.label.trim() || !m.accountNumber.trim())) {
        throw new Error("Every payment method needs a label and an account/phone number.");
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

  const dateCount = draft.schedule.length;
  const fundCount = (draft.funds || []).length;
  const paymentCount = (draft.paymentMethods || []).length;

  return (
    <div className="panel">
      <div className="setup-header">
        <h2 className="panel-title">Group Setup</h2>
        <span className="badge badge-admin">Admin only</span>
      </div>

      <CollapsibleSection
        icon="🏷️"
        title="Group Basics"
        summary={`${draft.groupName || "Untitled group"} · ${draft.cycleName || "no cycle set"}`}
        defaultOpen
      >
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
      </CollapsibleSection>

      <CollapsibleSection
        icon="📅"
        title="Payout Schedule"
        summary={dateCount === 0 ? "No dates set up" : `${dateCount} date${dateCount === 1 ? "" : "s"}`}
        defaultOpen
      >
        <h3 className="panel-subtitle">Generate Payout Dates</h3>
        <p className="muted tiny" style={{ marginBottom: 10 }}>
          Auto-fills a run of dates so you're not typing them one by one — every generated
          date stays a normal, editable row below, same as if you'd typed it in yourself.
        </p>
        <div className="field-row" style={{ alignItems: "flex-end" }}>
          <label className="field">
            Frequency
            <select value={genFrequency} onChange={(e) => setGenFrequency(e.target.value)}>
              {Object.entries(SCHEDULE_FREQUENCIES).map(([key, spec]) => (
                <option key={key} value={key}>{spec.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Start date
            <input type="date" value={genStartDate} onChange={(e) => setGenStartDate(e.target.value)} />
          </label>
          <label className="field" style={{ maxWidth: 120 }}>
            How many dates
            <input type="number" min={1} max={60} value={genCount} onChange={(e) => setGenCount(e.target.value)} />
          </label>
          <button className="btn-ghost-dark" onClick={generateDates}>Generate</button>
        </div>
        {genError && <div className="error-text" role="alert">{genError}</div>}

        <div className="grid-wrap" style={{ marginTop: 16 }}>
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
              {draft.schedule.map((r) => {
                const isMissing = missingRecipientIds.includes(r.id) && !r.payeesText.trim();
                return (
                <tr key={r.id} className={isMissing ? "row-flagged" : ""}>
                  <td data-label="Date"><input className="cell-input-text" value={r.date} onChange={(e) => editRow(r.id, "date", e.target.value)} /></td>
                  <td data-label="Group"><input className="cell-input-text" value={r.group} onChange={(e) => editRow(r.id, "group", e.target.value)} /></td>
                  <td data-label="Recipient(s)">
                    <input
                      className={"cell-input-text wide" + (isMissing ? " input-flagged" : "")}
                      value={r.payeesText}
                      onChange={(e) => editRow(r.id, "payeesText", e.target.value)}
                      placeholder="e.g. Doreen, Dorothy, Fridah"
                    />
                    {isMissing && <div className="error-text tiny">Needs a recipient</div>}
                  </td>
                  <td className="ar" data-label="Due (K)"><input type="number" className="cell-input" value={r.due} onChange={(e) => editRow(r.id, "due", e.target.value)} /></td>
                  <td className="cell-action"><button className="btn-icon" onClick={() => removeRow(r.id)} title="Remove row" aria-label={`Remove ${r.date || "this"} date`}>✕</button></td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button className="btn-ghost-dark" style={{ marginTop: 10 }} onClick={addRow}>+ Add date</button>
      </CollapsibleSection>

      <CollapsibleSection
        icon="💰"
        title="Community Funds"
        summary={fundCount === 0 ? "None set up" : `${fundCount} fund${fundCount === 1 ? "" : "s"}`}
      >
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
                  <td data-label="Fund name"><input className="cell-input-text wide" value={f.name} onChange={(e) => editFund(f.id, "name", e.target.value)} placeholder="e.g. Future Sharing Fund" /></td>
                  <td className="ar" data-label="Amount (K)"><input type="number" className="cell-input" value={f.amount} onChange={(e) => editFund(f.id, "amount", e.target.value)} /></td>
                  <td data-label="Loanable">
                    <input
                      type="checkbox"
                      checked={!!f.loanable}
                      onChange={(e) => editFund(f.id, "loanable", e.target.checked)}
                    />
                  </td>
                  <td className="cell-action"><button className="btn-icon" onClick={() => removeFund(f.id)} title="Remove fund" aria-label={`Remove ${f.name || "this"} fund`}>✕</button></td>
                </tr>
              ))}
              {(!draft.funds || draft.funds.length === 0) && (
                <tr><td colSpan={4} className="muted small">No community funds set up.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <button className="btn-ghost-dark" style={{ marginTop: 10 }} onClick={addFund}>+ Add fund</button>
      </CollapsibleSection>

      <CollapsibleSection
        icon="📱"
        title="Payment Details"
        summary={paymentCount === 0 ? "Not set up" : `${paymentCount} method${paymentCount === 1 ? "" : "s"}`}
      >
        <p className="muted tiny" style={{ marginBottom: 10 }}>
          Where members should actually send their contribution. Shown to every member on
          their ledger — see the "Where to Pay" section.
        </p>
        <div className="grid-wrap">
          <table className="grid-table">
            <thead>
              <tr>
                <th className="al">Type</th>
                <th className="al">Label</th>
                <th className="al">Account name</th>
                <th className="al">Number</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(draft.paymentMethods || []).map((m) => (
                <tr key={m.id}>
                  <td data-label="Type">
                    <select
                      className="cell-input-text"
                      value={m.type}
                      onChange={(e) => editPaymentMethod(m.id, "type", e.target.value)}
                    >
                      <option value="mobile">Mobile Money</option>
                      <option value="bank">Bank</option>
                    </select>
                  </td>
                  <td data-label="Label">
                    <input
                      className="cell-input-text"
                      value={m.label}
                      onChange={(e) => editPaymentMethod(m.id, "label", e.target.value)}
                      placeholder={m.type === "bank" ? "e.g. Zanaco" : "e.g. MTN Money"}
                    />
                  </td>
                  <td data-label="Account name">
                    <input
                      className="cell-input-text"
                      value={m.accountName}
                      onChange={(e) => editPaymentMethod(m.id, "accountName", e.target.value)}
                      placeholder="e.g. Hillcrest Chilimba"
                    />
                  </td>
                  <td data-label="Number">
                    <input
                      className="cell-input-text wide"
                      value={m.accountNumber}
                      onChange={(e) => editPaymentMethod(m.id, "accountNumber", e.target.value)}
                      placeholder={m.type === "bank" ? "Account number" : "Phone number"}
                    />
                  </td>
                  <td className="cell-action"><button className="btn-icon" onClick={() => removePaymentMethod(m.id)} title="Remove" aria-label={`Remove ${m.label || "this"} payment method`}>✕</button></td>
                </tr>
              ))}
              {(!draft.paymentMethods || draft.paymentMethods.length === 0) && (
                <tr><td colSpan={5} className="muted small">No payment details set up yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <button className="btn-ghost-dark" style={{ marginTop: 10 }} onClick={addPaymentMethod}>+ Add payment method</button>
      </CollapsibleSection>

      <CollapsibleSection icon="📣" title="Invite Members" summary="WhatsApp-ready invite card">
        <p className="muted tiny" style={{ marginBottom: 10 }}>
          A shareable card with your group's name and code — post it straight to WhatsApp,
          or download it to send however you like.
        </p>
        <InviteCard groupName={config.groupName} groupSlug={session?.groupSlug} cycleName={config.cycleName} />
      </CollapsibleSection>

      <CollapsibleSection icon="👥" title="Roster & Admins" summary="Members, roles, next due dates">
        <AdminManagement />
      </CollapsibleSection>

      {error && <div className="error-text" style={{ marginTop: 14 }}>{error}</div>}

      <div className="field-row" style={{ marginTop: 14 }}>
        <button className="btn-primary" style={{ width: "auto" }} onClick={save}>Save Group Settings</button>
        <span className="muted small">{status}</span>
      </div>

      <p className="muted tiny" style={{ marginTop: 12 }}>
        Changes apply for every member using this ledger.
      </p>
    </div>
  );
}
