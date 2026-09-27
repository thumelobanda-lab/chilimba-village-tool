import React from "react";
import Icon from "./Icon.jsx";

/**
 * The read-only "where members send their contribution" card list —
 * shared by PaymentOptions.jsx's non-admin view and GroupSetup.jsx's
 * Payment Details summary, which used to each render their own copy of
 * this exact markup from the same config.paymentMethods array. One
 * shared, presentation-only component now; each caller still owns its
 * own empty-state message, since a regular member ("ask your group
 * leader") and an admin looking at their own setup ("not set up yet")
 * need different tones there.
 */
export default function PaymentMethodsList({ methods, emptyMessage }) {
  if (!methods || methods.length === 0) {
    return <p className="muted small">{emptyMessage}</p>;
  }
  return (
    <div className="payment-methods-list">
      {methods.map((m) => (
        <div className="payment-method-card" key={m.id}>
          <div className="payment-method-type">
            <Icon name={m.type === "bank" ? "bank" : "phone"} size={14} className="icon-inline" />{" "}
            {m.type === "bank" ? "Bank" : "Mobile Money"}
          </div>
          <div className="payment-method-label">{m.label}</div>
          <div className="muted small">{m.accountName}</div>
          <div className="payment-method-number">{m.accountNumber}</div>
        </div>
      ))}
    </div>
  );
}
