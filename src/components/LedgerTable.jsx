import React, { useEffect, useRef, useState } from "react";
import { payeesLabel } from "../lib/scheduleUtils.js";
import Receipt from "./Receipt.jsx";

const money = (n) => "K" + (Number(n) || 0).toLocaleString("en-ZM", { maximumFractionDigits: 0 });

// Same formatting convention as every other small per-component date
// formatter in this codebase (App.jsx, MyNextPayments.jsx, etc.) — kept
// local rather than shared.
function formatDate(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  if (isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-ZM", { weekday: "short", day: "numeric", month: "short" });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

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
  focusRowId,
  onFocusHandled,
}) {
  // One receipt modal for the whole list (not per-card) — only one entry's
  // receipt is ever open at a time, and keeping it here means Receipt
  // isn't remounted/rebuilt as cards expand and collapse.
  const [receiptFor, setReceiptFor] = useState(null); // { payment, row } | null

  const today = todayISO();
  // "Behind" is its own tone (amber, factual) rather than folded into the
  // ordinary due state — see the hero below. Recipients aren't special-
  // cased here: a recipient still owes money on their own date whenever
  // the group's policy doesn't exempt them (resolveDue), so `balance` alone
  // already carries that; isRecipientRow only adds the "your payout" tag.
  const unpaid = rowsComputed.filter((r) => r.balance > 0);
  const overdue = unpaid.filter((r) => r.date < today).sort((a, b) => (a.date < b.date ? -1 : 1));
  const dueNotYetOverdue = unpaid.filter((r) => r.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  const nextUnpaid = overdue[0] || dueNotYetOverdue[0] || null;
  const nextUpcomingRow = rowsComputed
    .filter((r) => r.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0] || null;

  return (
    <div className="payment-cards-wrap">
      <PaymentHero
        overdue={overdue}
        nextUnpaid={nextUnpaid}
        nextUpcomingRow={nextUpcomingRow}
        onAddPayment={onAddPayment}
      />

      <div className="payment-card-list">
        {rowsComputed.map((r) => (
          <PaymentCard
            key={r.id}
            row={r}
            allRows={rowsComputed}
            isRecipient={isRecipientRow(r)}
            today={today}
            onAddPayment={onAddPayment}
            onVoidPayment={onVoidPayment}
            onEditPayment={onEditPayment}
            onSetDueOverride={onSetDueOverride}
            onViewReceipt={(payment) => setReceiptFor({ payment, row: r })}
            premiumActive={premiumActive}
            autoOpen={r.id === focusRowId}
            onAutoOpened={onFocusHandled}
          />
        ))}
      </div>

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

// The first thing a member sees on this screen — one glance answers "do I
// owe anything right now, and if so, how much." Three states, in priority
// order: behind (amber, factual, never a bare number with no action beside
// it), due-but-not-late (neutral), all caught up (celebratory). Never an
// empty list — when nothing's due this still shows something, just not a
// due amount.
function PaymentHero({ overdue, nextUnpaid, nextUpcomingRow, onAddPayment }) {
  if (overdue.length > 0) {
    const totalOverdue = overdue.reduce((sum, r) => sum + r.balance, 0);
    const earliest = overdue[0];
    return (
      <div className="payment-hero payment-hero-behind">
        <div className="payment-hero-label">You're behind</div>
        <div className="payment-hero-amount">{money(totalOverdue)}</div>
        <div className="payment-hero-sub">
          {overdue.length === 1
            ? `1 payment overdue — ${formatDate(earliest.date)}`
            : `${overdue.length} payments overdue — earliest ${formatDate(earliest.date)}`}
        </div>
        <PayButton row={earliest} onAddPayment={onAddPayment} size="hero" />
      </div>
    );
  }

  if (nextUnpaid) {
    const isToday = nextUnpaid.date === new Date().toISOString().slice(0, 10);
    return (
      <div className="payment-hero payment-hero-due">
        <div className="payment-hero-label">{isToday ? "Due today" : `Due ${formatDate(nextUnpaid.date)}`}</div>
        <div className="payment-hero-amount">{money(nextUnpaid.balance)}</div>
        <PayButton row={nextUnpaid} onAddPayment={onAddPayment} size="hero" />
      </div>
    );
  }

  return (
    <div className="payment-hero payment-hero-ok">
      <div className="payment-hero-label">🎉 You're all paid up</div>
      <div className="payment-hero-sub">
        {nextUpcomingRow
          ? `Next payment: ${formatDate(nextUpcomingRow.date)} · ${money(nextUpcomingRow.due)}`
          : "No more payments scheduled"}
      </div>
    </div>
  );
}

// One tap, full amount, done — the button IS the form. A member who wants
// to pay something other than the full remaining balance still can, via
// a card's own Details panel below; this button only ever covers the
// common case, which is most taps most days.
function PayButton({ row, onAddPayment, size }) {
  const [busy, setBusy] = useState(false);
  const [justLogged, setJustLogged] = useState(false);
  const timeoutRef = useRef();
  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const pay = async () => {
    setBusy(true);
    try {
      await onAddPayment(row.id, row.balance, "");
      setJustLogged(true);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setJustLogged(false), 1800);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={"btn-pay" + (size === "hero" ? " btn-pay-hero" : "") + (justLogged ? " btn-pay-confirmed" : "")}
      disabled={busy}
      onClick={pay}
    >
      {busy ? "Saving…" : justLogged ? "✓ Logged" : `Pay ${money(row.balance)}`}
    </button>
  );
}

function StatusPill({ isPaid, isOverdue, nothingDue }) {
  if (nothingDue) return <span className="status-pill status-pill-due">Nothing due</span>;
  if (isPaid) return <span className="status-pill status-pill-paid">✓ Paid</span>;
  if (isOverdue) return <span className="status-pill status-pill-behind">Behind</span>;
  return <span className="status-pill status-pill-due">Due</span>;
}

function PaymentCard({
  row,
  allRows,
  isRecipient,
  today,
  onAddPayment,
  onVoidPayment,
  onEditPayment,
  onSetDueOverride,
  onViewReceipt,
  premiumActive,
  autoOpen,
  onAutoOpened,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingDue, setEditingDue] = useState(false);
  const [dueDraft, setDueDraft] = useState(row.due);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [justLogged, setJustLogged] = useState(false);
  const cardRef = useRef(null);
  const amountInputRef = useRef(null);
  const justLoggedTimeoutRef = useRef();
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [entryDraft, setEntryDraft] = useState("");
  const [entryDateDraft, setEntryDateDraft] = useState(row.id);
  const [entryBusy, setEntryBusy] = useState(false);

  const isPaid = row.balance <= 0;
  const isOverdue = !isPaid && row.date < today;
  // A recipient-exempt payout date, or any date whose due was overridden
  // to 0, where nothing was ever paid either — reads as "nothing due"
  // rather than a misleading "K0 paid ✓ Paid".
  const nothingDue = isPaid && row.due === 0 && row.paid === 0;

  // Deep-link target from the dashboard's "Log a Payment" CTA (see
  // App.jsx's focusPaymentRowId) — opens this card's Details, scrolls it
  // into view, and focuses the custom-amount field, for the "I want to pay
  // something other than the full balance" path. Fires once per deep-link
  // (onAutoOpened clears the id in App.jsx), not on every re-render.
  useEffect(() => {
    if (!autoOpen) return;
    setDetailsOpen(true);
    const raf = requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      amountInputRef.current?.focus();
    });
    onAutoOpened?.();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);
  useEffect(() => () => clearTimeout(justLoggedTimeoutRef.current), []);

  const activeEntries = row.entries.filter((e) => !e.voidedAt);
  const voidedEntries = row.entries.filter((e) => e.voidedAt);

  const submitCustomAmount = async () => {
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
    <div
      ref={cardRef}
      className={"payment-card" + (isOverdue ? " payment-card-behind" : isPaid ? " payment-card-paid" : "")}
    >
      <div className="payment-card-top">
        <div className="payment-card-date">{formatDate(row.date)}</div>
        <StatusPill isPaid={isPaid} isOverdue={isOverdue} nothingDue={nothingDue} />
      </div>

      {isRecipient && (
        <div className="payment-card-note">
          {row.group}
          <span className="tag">your payout</span>
        </div>
      )}

      <div className={"payment-card-amount" + (isPaid ? " payment-card-amount-paid" : "")}>
        {nothingDue ? "Nothing due for this date" : isPaid ? `${money(row.paid)} paid` : `${money(row.balance)} due`}
      </div>

      {!isPaid && <PayButton row={row} onAddPayment={onAddPayment} />}

      <button
        type="button"
        className="payment-card-details-toggle"
        onClick={() => setDetailsOpen((o) => !o)}
      >
        {detailsOpen ? "Hide details ▴" : "Details ▾"}
      </button>

      {detailsOpen && (
        <div className="payment-card-details">
          <div className="payment-card-detail-row">
            <span className="muted tiny">Total paid so far</span>
            <span>{money(row.cumulative)}</span>
          </div>
          {row.balance > 0 && (
            <div className="payment-card-detail-row">
              <span className="muted tiny">Suggested</span>
              <span>{money(Math.round(row.suggested))}</span>
            </div>
          )}
          {!isRecipient && (
            <div className="payment-card-detail-row">
              <span className="muted tiny">Your agreed rate</span>
              {editingDue ? (
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
            </div>
          )}

          <div className="payment-card-history">
            <div className="payment-card-history-title">Payment history</div>
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
                    {e.pendingSync && (
                      <span className="pending-sync-tag" title="Saved on this device — will upload once you're back online">
                        waiting to sync
                      </span>
                    )}
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
                ref={amountInputRef}
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
                onClick={submitCustomAmount}
              >
                {busy ? "Saving…" : justLogged ? "✓ Logged" : "Log a different amount"}
              </button>
            </div>
            <p className="muted tiny" style={{ marginTop: 4 }}>
              A logged payment is pending until a group leader confirms it — you'll see the dot
              turn green once it's checked.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// A payment logged against a date that's since been removed from the
// schedule (see computeLedgerTotals in ledgerMath.js) — still counted
// toward `paid`, but with no card left to nest under, so it gets its own
// small section, dated by when it was actually logged since there's no
// due date left to show it against. "Move to a date" is the fix: pick a
// real current schedule date and it re-joins the ledger properly.
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

// Four visible states for a non-voided entry's bulb: still on this
// device and hasn't even reached the server yet (offline write queue —
// see offlineQueue.js), green once an admin has confirmed it, amber
// while it's a pending, member-submitted entry awaiting review (see
// addPayment in contributions.js), red if it was rejected. Anything else
// (status null — logged before the pending flow existed) reads as the
// original grey "not yet confirmed" — still counts fully, just
// unverified. pendingSync takes priority over every other state since
// none of the others are even meaningful until the server has the entry.
function bulbClass(entry) {
  if (entry.pendingSync) return "confirm-bulb-syncing";
  if (entry.confirmedAt) return "confirm-bulb-on";
  if (entry.rejectedAt) return "confirm-bulb-rejected";
  if (entry.status === "pending") return "confirm-bulb-pending";
  return "confirm-bulb-off";
}

function bulbTitle(entry) {
  if (entry.pendingSync) return "Saved on this device — will upload once you're back online";
  if (entry.confirmedAt) return `Confirmed by a group leader (${entry.confirmedBy})`;
  if (entry.rejectedAt) return `Not confirmed by ${entry.rejectedBy}${entry.rejectionReason ? `: ${entry.rejectionReason}` : ""}`;
  if (entry.status === "pending") return "Pending — awaiting group leader review";
  return "Not yet confirmed by a group leader";
}

export { money };
