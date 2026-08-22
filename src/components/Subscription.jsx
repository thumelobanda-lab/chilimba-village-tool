import React, { useState } from "react";
import { initiateSubscriptionPayment, subscriptionPrice, subscriptionDurationDays } from "../lib/api.js";

const NETWORKS = ["MTN Money", "Airtel Money", "Zamtel Kwacha"];

// Admin-only — App.jsx renders this exclusively for session.role === "admin"
// and renders SubscriptionGate.jsx (the read-only view) for everyone
// else. `status` is lifted into App.jsx's useSubscription hook rather
// than fetched here, since the free-tier banner on the dashboard needs
// the same data — `onPaid` tells the parent to refetch after a claim is
// submitted.
//
// Submitting no longer activates anything instantly — see
// worker/src/routes/subscription.js's comment for why: the old version
// of this screen activated the group the moment "Pay" was clicked, with
// no real mobile money charge behind it at all. Now it submits a claim
// that sits pending until a platform owner checks the money actually
// arrived and confirms it (see routes/owner.js) — this screen's job is
// just to show that state honestly, not pretend it's instant.
export default function Subscription({ status, onPaid }) {
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState(NETWORKS[0]);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const price = subscriptionPrice();
  const months = Math.round(subscriptionDurationDays() / 30);

  const pay = async () => {
    setError("");
    if (!phone.trim()) {
      setError("Enter the mobile money number to charge.");
      return;
    }
    setPaying(true);
    try {
      await initiateSubscriptionPayment({ phone: phone.trim(), network });
      setPhone(""); // clear the number from memory once the claim is sent
      setSubmitted(true);
      await onPaid?.();
    } catch (e) {
      setError(e.message || "Could not submit the payment claim. Try again.");
    } finally {
      setPaying(false);
    }
  };

  if (!status) return <div className="panel">Checking subscription…</div>;

  if (status.active) {
    return (
      <div className="panel">
        <div className="badge badge-ok">Premium active</div>
        <p className="muted small">
          This group's premium access is valid until {new Date(status.expiresAt).toLocaleDateString()}.
        </p>
      </div>
    );
  }

  if (status.pending || submitted) {
    return (
      <div className="panel">
        <div className="badge badge-admin">Payment submitted — awaiting confirmation</div>
        <p className="muted small">
          Your K{price} payment claim has been recorded. A platform owner checks that the
          money actually arrived before this group's premium access activates — this
          usually takes a short while, not instantly. You'll see it flip to active here,
          and there's nothing more to do in the meantime.
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2 className="panel-title">Upgrade to Premium</h2>
      <p className="muted small">
        K{price} unlocks premium features for every member of the group for {months} months —
        one-time group payment, members never pay individually. Your group already works on
        the free plan (up to {status.freeTierMaxMembers} members, core payment-tracking features); this
        adds receipts, automated reminders, and community fund splitting.
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
        {paying ? "Submitting…" : `Submit K${price} payment via ${network}`}
      </button>

      <p className="muted tiny">
        Your number is only used to request the payment and is never stored in full —
        only the last 3 digits are kept, for your own reference. This submits a claim for
        review; it does not activate anything by itself.
      </p>
    </div>
  );
}
