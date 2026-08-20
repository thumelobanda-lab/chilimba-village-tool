import React, { useEffect, useState } from "react";
import { getSubscriptionStatus, initiateSubscriptionPayment, subscriptionPrice, subscriptionDurationDays } from "../lib/api.js";

const NETWORKS = ["MTN Money", "Airtel Money", "Zamtel Kwacha"];

// Admin-only — App.jsx renders this exclusively for session.role === "admin"
// and renders SubscriptionGate.jsx (no pricing, no payment controls) for
// everyone else, so there's no non-admin branch (and no need for session
// itself) to handle here anymore.
export default function Subscription({ onActive }) {
  const [status, setStatus] = useState(null);
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState(NETWORKS[0]);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const price = subscriptionPrice();
  const months = Math.round(subscriptionDurationDays() / 30);

  const refresh = async () => {
    const s = await getSubscriptionStatus();
    setStatus(s);
    if (s.active) onActive?.();
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pay = async () => {
    setError("");
    if (!phone.trim()) {
      setError("Enter the mobile money number to charge.");
      return;
    }
    setPaying(true);
    try {
      await initiateSubscriptionPayment({ phone: phone.trim(), network });
      setPhone(""); // clear the number from memory once the charge is sent
      await refresh();
    } catch (e) {
      setError(e.message || "Payment could not be started. Try again.");
    } finally {
      setPaying(false);
    }
  };

  if (!status) return <div className="panel">Checking subscription…</div>;

  if (status.active) {
    return (
      <div className="panel">
        <div className="badge badge-ok">Subscription active</div>
        <p className="muted small">
          This group's access is valid until {new Date(status.expiresAt).toLocaleDateString()}.
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2 className="panel-title">Activate Your Group's Subscription</h2>
      <p className="muted small">
        K{price} unlocks this app for every member of the group for {months} months. This is a
        one-time group payment — members never pay individually.
      </p>

      <label className="field">
        Network
        <select value={network} onChange={(e) => setNetwork(e.target.value)}>
          {NETWORKS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>

      <label className="field">
        Mobile money number
        <input
          type="tel"
          placeholder="e.g. 097 XXX XXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="off"
        />
      </label>

      {error && <div className="error-text" role="alert">{error}</div>}

      <button className="btn-primary" onClick={pay} disabled={paying}>
        {paying ? "Waiting for approval…" : `Pay K${price} via ${network}`}
      </button>

      <p className="muted tiny">
        Your number is only used to request the payment prompt and is never stored in
        full — only the last 3 digits are kept, for your own reference. This demo runs
        in mock mode until a real mobile money aggregator is wired up on the backend.
      </p>
    </div>
  );
}
