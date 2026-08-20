import React, { useState } from "react";
import { updateProfile } from "../lib/api.js";

// Self-service editing of the signed-in member's own account. Deliberately
// scoped to just two things: a cosmetic display-name fix (spelling/
// capitalization only — see updateProfile()'s validation for why a real
// rename isn't offered here) and changing your own PIN. Nothing here can
// touch another member's account — updateProfile() always acts on the
// signed-in session, never a name passed in from outside.
export default function Profile({ session, onRenamed }) {
  const [displayName, setDisplayName] = useState(session.name);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const nameChanged = displayName.trim() !== session.name && displayName.trim().length > 0;
  const wantsPinChange = !!(currentPin || newPin || confirmPin);

  const save = async () => {
    setError("");
    if (!nameChanged && !wantsPinChange) {
      setError("Change your name or fill in the PIN fields first.");
      return;
    }
    if (wantsPinChange) {
      if (!currentPin) {
        setError("Enter your current PIN to set a new one.");
        return;
      }
      if (newPin.length < 4) {
        setError("New PIN must be at least 4 digits.");
        return;
      }
      if (newPin !== confirmPin) {
        setError("New PIN and confirmation don't match.");
        return;
      }
    }

    setBusy(true);
    try {
      const result = await updateProfile({
        displayName: nameChanged ? displayName.trim() : undefined,
        currentPin: wantsPinChange ? currentPin : undefined,
        newPin: wantsPinChange ? newPin : undefined,
      });
      if (result?.name) onRenamed?.(result.name);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setStatus("Saved");
    } catch (e) {
      setError(e.message || "Could not save your changes.");
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(""), 1500);
    }
  };

  return (
    <div className="panel">
      <h2 className="panel-title">My Account</h2>
      <p className="muted small">
        Update how your name is shown, or change your PIN. This only ever affects your own
        account — nobody else's info is touched.
      </p>

      <label className="field">
        Display name
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={busy}
        />
      </label>
      <p className="muted tiny" style={{ marginTop: -6, marginBottom: 14 }}>
        You can fix spelling or capitalization here. To change to a genuinely different
        name, ask an admin — your name is also how the payout schedule recognizes you.
      </p>

      <h3 className="panel-subtitle">Change PIN</h3>
      <label className="field">
        Current PIN
        <input
          type="password"
          inputMode="numeric"
          value={currentPin}
          onChange={(e) => setCurrentPin(e.target.value)}
          placeholder="••••"
          autoComplete="current-password"
          disabled={busy}
        />
      </label>
      <div className="field-row">
        <label className="field">
          New PIN (4+ digits)
          <input
            type="password"
            inputMode="numeric"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            placeholder="••••"
            autoComplete="new-password"
            disabled={busy}
          />
        </label>
        <label className="field">
          Confirm new PIN
          <input
            type="password"
            inputMode="numeric"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            placeholder="••••"
            autoComplete="new-password"
            disabled={busy}
          />
        </label>
      </div>

      {error && <div className="error-text" role="alert">{error}</div>}

      <div className="field-row" style={{ marginTop: 10 }}>
        <button className="btn-primary" style={{ width: "auto" }} disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        <span className="muted small">{status}</span>
      </div>
    </div>
  );
}
