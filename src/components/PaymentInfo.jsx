import React from "react";

/**
 * Shows where members should actually send their biweekly contribution
 * — mobile money numbers, bank details — set by an admin in Group Setup.
 * Renders nothing if no payment methods are configured yet, rather than
 * showing an empty/confusing card.
 */
export default function PaymentInfo({ paymentMethods }) {
  if (!paymentMethods || paymentMethods.length === 0) return null;

  return (
    <div className="payout-block" style={{ marginTop: 0, marginBottom: 20, paddingTop: 0, borderTop: "none" }}>
      <h3 className="panel-subtitle">Where to Pay</h3>
      <div className="payment-methods-list">
        {paymentMethods.map((m) => (
          <div className="payment-method-card" key={m.id}>
            <div className="payment-method-type">{m.type === "bank" ? "🏦 Bank" : "📱 Mobile Money"}</div>
            <div className="payment-method-label">{m.label}</div>
            <div className="muted small">{m.accountName}</div>
            <div className="payment-method-number">{m.accountNumber}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
