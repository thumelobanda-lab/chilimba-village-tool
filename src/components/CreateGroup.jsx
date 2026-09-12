import React, { useState } from "react";
import TermsModal from "./TermsModal.jsx";
import PrivacyModal from "./PrivacyModal.jsx";

export default function CreateGroup({ onCreate, onBackToLogin }) {
  const [groupName, setGroupName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [pin, setPin] = useState("");
  // Optional, greeting-phrasing-only — same field as Login.jsx's sign-up
  // form (see dashboardMath.js's genderedAddress).
  const [gender, setGender] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Creating a group also creates a brand-new admin account — this is
  // "a new admin registering", same as Login.jsx's sign-up checkbox, so
  // it gets the same unchecked-by-default gate.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const submit = async () => {
    setError("");
    if (busy) return;
    if (!groupName.trim() || !adminName.trim()) {
      setError("Fill in the group name and your name.");
      return;
    }
    if (!termsAccepted) {
      setError("You must agree to the Terms & Conditions to create a group.");
      return;
    }
    setBusy(true);
    try {
      // No group code here — the backend generates one and hands it
      // back in the response (see onCreate's caller: CreateAnotherGroup.jsx
      // shows it, Login.jsx's dev-only path signs straight in). A
      // human-chosen code trades away the one thing that matters most
      // for a shared login secret: not being guessable.
      await onCreate({ groupName: groupName.trim(), adminName: adminName.trim(), pin, termsAccepted, gender });
    } catch (e) {
      setError(e.message || "Could not create the group.");
    } finally {
      setBusy(false);
    }
  };

  const onEnter = (e) => e.key === "Enter" && submit();

  return (
    <div className="panel login-panel">
      <h2 className="panel-title">Create a Chilimba group</h2>
      <p className="muted small" style={{ marginBottom: 14 }}>
        You'll be the group's first group leader — you can promote a co-leader later by asking
        them to sign up, then setting their role directly in the database. A group code for
        members to sign in with is generated automatically once you create the group.
      </p>

      <label className="field">
        Group name
        <input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          onKeyDown={onEnter}
          placeholder="e.g. Hillcrest Chilimba"
          autoComplete="organization"
          autoFocus
          disabled={busy}
        />
      </label>
      <label className="field">
        Your name
        <input
          value={adminName}
          onChange={(e) => setAdminName(e.target.value)}
          onKeyDown={onEnter}
          placeholder="e.g. Harriet"
          autoComplete="username"
          disabled={busy}
        />
      </label>
      <label className="field">
        How should we address you? (optional)
        <select value={gender} onChange={(e) => setGender(e.target.value)} disabled={busy}>
          <option value="">Prefer not to say</option>
          <option value="female">Sister</option>
          <option value="male">Brother</option>
        </select>
      </label>
      <label className="field">
        Choose a PIN (4+ digits)
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={onEnter}
          placeholder="••••"
          autoComplete="new-password"
          disabled={busy}
        />
      </label>

      <label className="checkbox-field" style={{ marginBottom: 14 }}>
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          disabled={busy}
        />
        I agree to the{" "}
        <button type="button" className="btn-link" onClick={() => setShowTerms(true)}>
          Terms &amp; Conditions
        </button>{" "}
        and{" "}
        <button type="button" className="btn-link" onClick={() => setShowPrivacy(true)}>
          Privacy Policy
        </button>
      </label>

      {error && <div className="error-text" role="alert" aria-live="assertive">{error}</div>}

      <button className="btn-primary" disabled={busy || !termsAccepted} onClick={submit}>
        {busy ? "Creating…" : "Create group"}
      </button>
      {onBackToLogin && (
        <button className="btn-link" style={{ display: "block", margin: "10px auto 0" }} onClick={onBackToLogin} disabled={busy}>
          Already have a group code? Sign in instead
        </button>
      )}

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    </div>
  );
}
