import React, { useState } from "react";
import { saveSchedule } from "../lib/api.js";
import PaymentMethodsEditor from "./PaymentMethodsEditor.jsx";

/**
 * A dedicated, easy-to-find home for "how do I actually pay" — members
 * need this to make their contribution at all, so it gets its own
 * top-level nav-menu entry rather than being buried inside My Ledger
 * (still shown there too, via PaymentInfo.jsx, for convenience) or
 * behind Group Setup's admin-only collapsible section. Read-only for
 * regular members; admins get the same editor GroupSetup.jsx uses
 * (PaymentMethodsEditor.jsx), saving straight from here instead of
 * needing to go find Group Setup for a small change.
 */
export default function PaymentOptions({ session, config, onSaved }) {
  const isAdmin = session?.role === "admin";
  const [draft, setDraft] = useState(config.paymentMethods || []);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    if (draft.some((m) => !m.label.trim() || !m.accountNumber.trim())) {
      setError("Every payment method needs at least a provider/bank and a number.");
      return;
    }
    setBusy(true);
    setStatus("Saving…");
    try {
      const nextConfig = { ...config, paymentMethods: draft };
      await saveSchedule(nextConfig);
      onSaved(nextConfig);
      setStatus("Saved");
    } catch (e) {
      setError(e.message || "Could not save payment options.");
      setStatus("");
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(""), 1500);
    }
  };

  if (!isAdmin) {
    return (
      <div className="panel">
        <h2 className="panel-title">Payment Options</h2>
        <p className="muted small" style={{ marginBottom: 14 }}>
          Where to actually send your contribution — mobile money and/or bank details, set
          up by your group's admin.
        </p>
        {config.paymentMethods && config.paymentMethods.length > 0 ? (
          <div className="payment-methods-list">
            {config.paymentMethods.map((m) => (
              <div className="payment-method-card" key={m.id}>
                <div className="payment-method-type">{m.type === "bank" ? "🏦 Bank" : "📱 Mobile Money"}</div>
                <div className="payment-method-label">{m.label}</div>
                <div className="muted small">{m.accountName}</div>
                <div className="payment-method-number">{m.accountNumber}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted small">
            No payment details set up yet — ask your admin where to send your contribution.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="setup-header">
        <h2 className="panel-title">Payment Options</h2>
        <span className="badge badge-admin">Admin</span>
      </div>
      <p className="muted small" style={{ marginBottom: 14 }}>
        Mobile money and/or bank details for where members should send their contribution
        — both can be set at once, add as many as you need. Visible to every member. This
        is the same data as Group Setup → Payment Details; edit either place, they stay in
        sync.
      </p>

      <PaymentMethodsEditor methods={draft} onChange={setDraft} />

      {error && <div className="error-text" role="alert" style={{ marginTop: 10 }}>{error}</div>}

      <div className="field-row" style={{ marginTop: 14, alignItems: "center" }}>
        <button className="btn-primary" style={{ width: "auto" }} disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save Payment Options"}
        </button>
        <span className="muted small" aria-live="polite">{status}</span>
      </div>
    </div>
  );
}
