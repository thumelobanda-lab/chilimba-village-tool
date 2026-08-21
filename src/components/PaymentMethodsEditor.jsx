import React from "react";

function uidMethod() {
  return "pay" + Date.now() + Math.random().toString(36).slice(2, 6);
}

/**
 * The add/edit/remove table for a group's payment methods (mobile money
 * and/or bank details — both can coexist, this is a list, not a single
 * either/or field). Extracted out of GroupSetup.jsx so both its
 * "Payment Details" section and PaymentOptions.jsx's dedicated admin
 * editor share one implementation instead of two that could quietly
 * drift apart. Purely controlled: onChange(nextMethods) is the only way
 * this talks back to its parent — it holds no save logic or state of
 * its own, so each caller decides when/how to persist (GroupSetup
 * batches it into one big "Save Group Settings"; PaymentOptions.jsx
 * saves it on its own, immediately).
 */
export default function PaymentMethodsEditor({ methods, onChange }) {
  const list = methods || [];

  const editMethod = (id, field, value) => {
    onChange(list.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const addMethod = () => {
    onChange([...list, { id: uidMethod(), type: "mobile", label: "", accountName: "", accountNumber: "" }]);
  };

  const removeMethod = (id) => {
    onChange(list.filter((m) => m.id !== id));
  };

  return (
    <>
      <div className="grid-wrap">
        <table className="grid-table">
          <thead>
            <tr>
              <th className="al">Type</th>
              <th className="al">Provider / Bank</th>
              <th className="al">Account name</th>
              <th className="al">Number</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.id}>
                <td data-label="Type">
                  <select
                    className="cell-input-text"
                    value={m.type}
                    onChange={(e) => editMethod(m.id, "type", e.target.value)}
                  >
                    <option value="mobile">Mobile Money</option>
                    <option value="bank">Bank</option>
                  </select>
                </td>
                <td data-label="Provider / Bank">
                  <input
                    className="cell-input-text"
                    value={m.label}
                    onChange={(e) => editMethod(m.id, "label", e.target.value)}
                    placeholder={m.type === "bank" ? "e.g. Zanaco" : "e.g. MTN Money"}
                  />
                </td>
                <td data-label="Account name">
                  <input
                    className="cell-input-text"
                    value={m.accountName}
                    onChange={(e) => editMethod(m.id, "accountName", e.target.value)}
                    placeholder="e.g. Hillcrest Chilimba"
                  />
                </td>
                <td data-label="Number">
                  <input
                    className="cell-input-text wide"
                    value={m.accountNumber}
                    onChange={(e) => editMethod(m.id, "accountNumber", e.target.value)}
                    placeholder={m.type === "bank" ? "Account number" : "Phone number"}
                  />
                </td>
                <td className="cell-action">
                  <button
                    className="btn-icon"
                    onClick={() => removeMethod(m.id)}
                    title="Remove"
                    aria-label={`Remove ${m.label || "this"} payment method`}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} className="muted small">No payment details set up yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <button className="btn-ghost-dark" style={{ marginTop: 10 }} onClick={addMethod}>+ Add payment method</button>
    </>
  );
}
