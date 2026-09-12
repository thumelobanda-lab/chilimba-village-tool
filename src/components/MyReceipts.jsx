import React, { useState } from "react";
import { money } from "./LedgerTable.jsx";
import { buildReferenceNumber } from "../lib/receipt.js";
import Receipt from "./Receipt.jsx";
import Icon from "./Icon.jsx";

function formatDate(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  if (isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-ZM", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Every confirmed payment across the whole ledger, in one place — the
 * "Receipt" link buried in each date's expanded history in
 * LedgerTable.jsx still works the same way, this is just the dedicated,
 * discoverable list of the same underlying receipts (see useReceipts.js:
 * a receipt is a computed view of a confirmed entry, not a separate
 * record, so there's nothing extra to fetch here).
 */
export default function MyReceipts({ receipts, memberName, groupName, cycleName, premiumActive, onUpgrade }) {
  const [receiptFor, setReceiptFor] = useState(null); // { entry, row } | null

  if (!premiumActive) {
    return (
      <div>
        <p className="muted small">
          Receipts are a Premium feature. Upgrade your group's plan to view, download, and share a
          receipt for every confirmed payment.
        </p>
        {onUpgrade && (
          <button className="btn-primary" style={{ width: "auto" }} onClick={onUpgrade}>
            See upgrade options
          </button>
        )}
      </div>
    );
  }

  if (receipts.length === 0) {
    return <p className="muted small">No confirmed payments yet — a receipt appears here as soon as a group leader confirms one.</p>;
  }

  return (
    <>
      <div className="upcoming-list">
        {receipts.map(({ entry, row }) => (
          <div className="upcoming-item" key={entry.id}>
            <div className="upcoming-item-date">
              <div className="upcoming-item-day">{formatDate(row.date)}</div>
              <div className="muted tiny">{buildReferenceNumber(entry.id)}</div>
            </div>
            <div className="upcoming-item-info">
              <div className="upcoming-item-payee">{row.group}</div>
              <div className="muted tiny">Confirmed {new Date(entry.confirmedAt).toLocaleDateString()}</div>
            </div>
            <div className="upcoming-item-amount">{money(entry.amount)}</div>
            <button className="receipt-link" onClick={() => setReceiptFor({ entry, row })}>
              <Icon name="receipt" size={13} className="icon-inline" /> View
            </button>
          </div>
        ))}
      </div>

      {receiptFor && (
        <Receipt
          payment={receiptFor.entry}
          scheduleRow={receiptFor.row}
          memberName={memberName}
          groupName={groupName}
          cycleName={cycleName}
          onClose={() => setReceiptFor(null)}
        />
      )}
    </>
  );
}
