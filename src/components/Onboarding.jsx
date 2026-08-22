import React, { useState } from "react";

export default function Onboarding({ groupName, groupDefaultRate, onComplete, onSkip }) {
  const [rate, setRate] = useState(groupDefaultRate || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!rate || Number(rate) <= 0) {
      setError("Enter the amount you've agreed to pay each date.");
      return;
    }
    setBusy(true);
    try {
      await onComplete(Number(rate));
    } catch (e) {
      setError(e.message || "Could not save your rate.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel login-panel">
      {groupName && <div className="badge badge-ok">✓ You've joined {groupName}</div>}
      <h2 className="panel-title">Welcome — one quick step</h2>

      <label className="field">
        Your agreed rate (K)
        <input
          type="number"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={groupDefaultRate ? String(groupDefaultRate) : "e.g. 1700"}
        />
      </label>

      {error && <div className="error-text">{error}</div>}

      <button className="btn-primary" disabled={busy} onClick={submit}>
        {busy ? "Saving…" : "Save and continue"}
      </button>
      <button className="btn-link" style={{ display: "block", margin: "10px auto 0" }} onClick={onSkip}>
        Skip — use the group default for now
      </button>

      <p className="muted tiny" style={{ marginTop: 12 }}>
        You can still change individual dates any time from My Payment History.
      </p>
    </div>
  );
}
