import React from "react";
import PaymentMethodsList from "./PaymentMethodsList.jsx";

/**
 * Shows where members should actually send their biweekly contribution
 * — mobile money numbers, bank details — set by an admin in Group Setup.
 * Renders nothing if no payment methods are configured yet, rather than
 * showing an empty/confusing card.
 */
export default function PaymentInfo({ paymentMethods }) {
  if (!paymentMethods || paymentMethods.length === 0) return null;

  return (
    <div
      className="payout-block"
      style={{ marginTop: 0, marginBottom: 20, paddingTop: 0, borderTop: "none" }}
      data-tour="payment-info-panel"
    >
      <h3 className="panel-subtitle">Where to Pay</h3>
      <PaymentMethodsList methods={paymentMethods} />
    </div>
  );
}
