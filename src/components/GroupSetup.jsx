import React, { useState } from "react";
import { saveSchedule } from "../lib/api.js";
import { getPayees, generateScheduleDates, cycleEndDate, SCHEDULE_FREQUENCIES, unassignedMembers } from "../lib/scheduleUtils.js";
import { useMemberRoster } from "../hooks/useMemberRoster.js";
import AdminManagement from "./AdminManagement.jsx";
import CollapsibleSection from "./CollapsibleSection.jsx";
import InviteCard from "./InviteCard.jsx";
import PaymentMethodsEditor from "./PaymentMethodsEditor.jsx";
import Toast from "./Toast.jsx";

function formatDate(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  if (isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-ZM", { day: "numeric", month: "short", year: "numeric" });
}

export default function GroupSetup({ config, onSaved, session, premiumActive }) {
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

  const { members: roster } = useMemberRoster();

  // Live, from the in-progress draft (payeesText, not yet re-split into
  // `payees` — that only happens in save() below) so this updates the
  // instant an admin types a name in, not just after saving.
  const draftPayeesPerRow = draft.schedule.map((r) =>
    (r.payeesText || "").split(/[,/]/).map((s) => s.trim()).filter(Boolean)
  );
  const unassigned = unassignedMembers(draftPayeesPerRow, roster.map((m) => m.name));

  const [missingRecipientIds, setMissingRecipientIds] = useState([]);
  // Frequency is a real, persisted group setting now (see paymentInterval
  // in the saved draft below and useGroupConfig.js's EMPTY_CONFIG) — it
  // survives logout instead of quietly resetting to "biweekly" every
  // time this screen is reopened. Start date deliberately is NOT
  // literally replayed the same way: re-generating from a stale old
  // start date would overlap the dates already on the schedule instead
  // of extending it, so it's smart-defaulted below to the day after the
  // schedule's current last date instead — the one value where
  // "remember exactly what I typed last time" would actually be a bug,
  // not a convenience.
  const [genFrequency, setGenFrequency] = useState(config.paymentInterval || "biweekly");
  const [genStartDate, setGenStartDate] = useState(() => {
    const lastDate = cycleEndDate(config.schedule);
    if (!lastDate) return "";
    const d = new Date(lastDate + "T00:00:00");
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [genCount, setGenCount] = useState(10);
  const [genError, setGenError] = useState("");

  const setFrequency = (value) => {
    setGenFrequency(value);
    setDraft((d) => ({ ...d, paymentInterval: value }));
  };

  // Live preview — the anticipated cycle-end date this generator would
  // produce with its current inputs, before "Generate" is even clicked.
  // Purely informational: one date per member is the common case this
  // estimates for, but a date can have up to 3 recipients, so a group
  // running multiple people per date will finish sooner than this shows.
  const projectedDates = genStartDate && Number(genCount) > 0
    ? generateScheduleDates(genFrequency, genStartDate, Number(genCount) || 0)
    : [];
  const projectedEndDate = projectedDates.at(-1) || null;

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
      if (Number(toSave.communityFundDeduction) < 0) {
        throw new Error("Community fund deduction can't be negative.");
      }
      if (Number(toSave.latePenaltyAmount) < 0) {
        throw new Error("Late payment penalty can't be negative.");
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

  // The 4 sections that are actually "fill this in" tasks (vs. Invite
  // Members / Members & Group Leaders below, which are always-available
  // views with nothing to complete) — drives both the hero's "X of 4"
  // readout and each section's own done badge.
  const basicsDone = !!draft.groupName?.trim() && !!draft.cycleName?.trim();
  const scheduleDone = dateCount > 0;
  const fundsDone = fundCount > 0 || Number(draft.communityFundDeduction) > 0 || Number(draft.latePenaltyAmount) > 0;
  const paymentDetailsDone = paymentCount > 0;
  const essentialTotal = 4;
  const essentialDone = [basicsDone, scheduleDone, fundsDone, paymentDetailsDone].filter(Boolean).length;

  return (
    <div className="panel">
      <div className="setup-hero">
        <h2 className="setup-hero-title">Let's get your group set up</h2>
        <p className="setup-hero-sub">
          A few short sections below — payout dates, savings funds, and where members should
          send their contributions. Nothing here is permanent; come back and change any of it
          any time.
        </p>
        <span className="setup-hero-progress">{essentialDone} of {essentialTotal} sections set up</span>
      </div>

      <div className="setup-header">
        <h2 className="panel-title">Group Setup</h2>
        <span className="badge badge-admin">Group Leader only</span>
      </div>

      <CollapsibleSection
        icon="🏷️"
        title="Group Basics"
        summary={`${draft.groupName || "Untitled group"} · ${draft.cycleName || "no round name set"}`}
        done={basicsDone}
        defaultOpen
      >
        <div className="field-row">
          <label className="field">
            Group name
            <input value={draft.groupName} onChange={(e) => setDraft({ ...draft, groupName: e.target.value })} />
          </label>
          <label className="field">
            Round name
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
        summary={
          (dateCount === 0
            ? "No dates set up"
            : `${dateCount} date${dateCount === 1 ? "" : "s"}` +
              (cycleEndDate(draft.schedule) ? ` · ends ${formatDate(cycleEndDate(draft.schedule))}` : "")) +
          (unassigned.length > 0 ? ` · ${unassigned.length} unassigned` : "")
        }
        done={scheduleDone}
        defaultOpen
      >
        {unassigned.length > 0 && (
          <div className="unassigned-members-notice">
            <strong>{unassigned.length}</strong> member{unassigned.length === 1 ? "" : "s"} not on the
            schedule yet: {unassigned.join(", ")}. Add {unassigned.length === 1 ? "them" : "each"} as a
            Recipient below to give {unassigned.length === 1 ? "them" : "them all"} a payout turn.
          </div>
        )}
        <h3 className="panel-subtitle">Generate Payout Dates</h3>
        <p className="muted tiny" style={{ marginBottom: 10 }}>
          Auto-fills a run of dates so you're not typing them one by one — every generated
          date stays a normal, editable row below, same as if you'd typed it in yourself.
        </p>
        <div className="field-row" style={{ alignItems: "flex-end" }}>
          <label className="field">
            Frequency
            <select value={genFrequency} onChange={(e) => setFrequency(e.target.value)}>
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
          {roster.length > 0 && (
            <button
              type="button"
              className="btn-link"
              onClick={() => setGenCount(roster.length)}
              title="One date per active member — a date with more than one recipient will need fewer than this"
            >
              Match {roster.length} member{roster.length === 1 ? "" : "s"}
            </button>
          )}
          <button className="btn-ghost-dark" onClick={generateDates}>Generate</button>
        </div>
        {genError && <div className="error-text" role="alert">{genError}</div>}
        {projectedEndDate && (
          <p className="muted small" style={{ marginTop: 6 }}>
            📅 Anticipated cycle-end date: <strong>{formatDate(projectedEndDate)}</strong>{" "}
            ({genCount} date{Number(genCount) === 1 ? "" : "s"}, {SCHEDULE_FREQUENCIES[genFrequency]?.label.toLowerCase()})
          </p>
        )}

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
                      list="group-setup-roster"
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
        <datalist id="group-setup-roster">
          {roster.map((m) => <option key={m.name} value={m.name} />)}
        </datalist>
      </CollapsibleSection>

      <CollapsibleSection
        icon="💰"
        title="Group Savings Funds"
        summary={fundCount === 0 ? "None set up" : `${fundCount} fund${fundCount === 1 ? "" : "s"}`}
        done={fundsDone}
      >
        <h3 className="panel-subtitle">Automatic Payment Split</h3>
        <p className="muted tiny" style={{ marginBottom: 10 }}>
          A fixed amount taken off every payment once a group leader confirms it — the rest still
          counts toward the member's due. Split into one always-on "Group Savings Fund" balance
          (shown in the Community tab and on the dashboard), separate from the named funds
          below. Set to K0 to turn it off.
        </p>
        {!premiumActive && (
          <p className="muted small" style={{ marginBottom: 10 }}>
            This is a premium feature — this group is on the free plan. Upgrade from the
            Group Membership Plan tab to enable it.
          </p>
        )}
        <label className="field" style={{ maxWidth: 220, marginBottom: 16 }}>
          Deduction per confirmed payment (K)
          <input
            type="number"
            min={0}
            disabled={!premiumActive}
            value={draft.communityFundDeduction || 0}
            onChange={(e) => setDraft({ ...draft, communityFundDeduction: Number(e.target.value) || 0 })}
          />
        </label>

        <h3 className="panel-subtitle">Late Payment Penalty</h3>
        <p className="muted tiny" style={{ marginBottom: 10 }}>
          A fixed amount added to the Group Savings Fund when a payment is confirmed after its
          due date — a separate line item from the payment split above, logged and visible to
          everyone in the Community tab. Set to K0 to turn it off. Never applies to a recipient's
          own payout-date row.
        </p>
        <label className="field" style={{ maxWidth: 220, marginBottom: 16 }}>
          Penalty for a late payment (K)
          <input
            type="number"
            min={0}
            disabled={!premiumActive}
            value={draft.latePenaltyAmount || 0}
            onChange={(e) => setDraft({ ...draft, latePenaltyAmount: Number(e.target.value) || 0 })}
          />
        </label>

        <h3 className="panel-subtitle">Named Funds</h3>
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
                <th className="al">Members Can Borrow?</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(draft.funds || []).map((f) => (
                <tr key={f.id}>
                  <td data-label="Fund name"><input className="cell-input-text wide" value={f.name} onChange={(e) => editFund(f.id, "name", e.target.value)} placeholder="e.g. Future Sharing Fund" /></td>
                  <td className="ar" data-label="Amount (K)"><input type="number" className="cell-input" value={f.amount} onChange={(e) => editFund(f.id, "amount", e.target.value)} /></td>
                  <td data-label="Members Can Borrow?">
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
                <tr><td colSpan={4} className="muted small">No group savings funds set up.</td></tr>
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
        done={paymentDetailsDone}
      >
        <p className="muted tiny" style={{ marginBottom: 10 }}>
          Where members should actually send their contribution. Shown to every member —
          also editable from its own dedicated "Payment Options" screen, not just here;
          both edit the same data.
        </p>
        <PaymentMethodsEditor
          methods={draft.paymentMethods}
          onChange={(next) => setDraft({ ...draft, paymentMethods: next })}
        />
      </CollapsibleSection>

      <CollapsibleSection icon="📣" title="Invite Members" summary="WhatsApp-ready invite card">
        <p className="muted tiny" style={{ marginBottom: 10 }}>
          A shareable card with your group's name and code — post it straight to WhatsApp,
          or download it to send however you like.
        </p>
        <InviteCard groupName={config.groupName} groupSlug={session?.groupSlug} cycleName={config.cycleName} />
      </CollapsibleSection>

      <CollapsibleSection icon="👥" title="Members & Group Leaders" summary="Members, roles, next due dates">
        <AdminManagement schedule={draft.schedule} />
      </CollapsibleSection>

      {error && <div className="error-text" style={{ marginTop: 14 }}>{error}</div>}

      <div className="field-row" style={{ marginTop: 14 }}>
        <button className="btn-primary" style={{ width: "auto" }} onClick={save}>Save Group Settings</button>
      </div>
      <Toast message={status} />

      <p className="muted tiny" style={{ marginTop: 12 }}>
        Changes apply for every member's payment history.
      </p>
    </div>
  );
}
