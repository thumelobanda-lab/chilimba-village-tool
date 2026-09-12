import React, { useState } from "react";
import TermsModal from "./TermsModal.jsx";
import PrivacyModal from "./PrivacyModal.jsx";

/**
 * Join or sign into a second (or third...) group without losing your
 * current session — the in-app entry point for real multi-group use,
 * reachable from GroupSwitcher.jsx. Deliberately a near-duplicate of
 * Login.jsx's form rather than a shared component: Login.jsx only ever
 * renders pre-session (invite-URL handling, "session ended" messaging,
 * the pre-login walkthrough) and is a critical, already-hardened path —
 * keeping this one small and self-contained means adding "join another
 * group" can't risk regressing the original sign-up/sign-in flow.
 *
 * Each group is still its own separate account (own PIN) — see
 * worker/schema/schema.sql's comment on why — so joining a second group
 * still means picking a PIN for it, same as the first. What this modal
 * actually saves is the logout/login round trip: on success the new
 * group is remembered on this device (useSession's join/login already do
 * that) and becomes the active one, without ever clearing the group you
 * came from.
 */
export default function AddGroupModal({ onJoin, onLogin, onClose }) {
  const [mode, setMode] = useState("join"); // "join" | "signin"
  const [groupSlug, setGroupSlug] = useState("");
  const [joinName, setJoinName] = useState("");
  const [phone, setPhone] = useState("");
  // Optional, greeting-phrasing-only — same field as Login.jsx's sign-up
  // form (see dashboardMath.js's genderedAddress).
  const [gender, setGender] = useState("");
  const [signinIdentifier, setSigninIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const isJoin = mode === "join";
  const canSubmit = isJoin
    ? !!(groupSlug.trim() && joinName.trim() && phone.trim() && termsAccepted)
    : !!(groupSlug.trim() && signinIdentifier.trim());

  const submit = async () => {
    setError("");
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      if (isJoin) {
        await onJoin(groupSlug.trim(), joinName.trim(), phone.trim(), pin, termsAccepted, gender);
      } else {
        await onLogin(groupSlug.trim(), signinIdentifier.trim(), pin);
      }
      onClose();
    } catch (e) {
      setError(e.message || (isJoin ? "Could not join." : "Could not sign in."));
    } finally {
      setBusy(false);
    }
  };

  const onEnter = (e) => e.key === "Enter" && submit();

  return (
    <div className="calc-modal-backdrop" onClick={onClose}>
      <div className="calc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calc-modal-header">
          <span>Join another group</span>
          <button className="calc-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="add-group-body">
          <p className="muted small" style={{ marginBottom: 14 }}>
            Your current group stays exactly as it is — this just adds another one you can
            switch to.
          </p>

          <div className="auth-mode-toggle" role="tablist" aria-label="Sign up or sign in">
            <button
              role="tab"
              aria-selected={isJoin}
              className={"auth-mode-tab" + (isJoin ? " auth-mode-tab-active" : "")}
              onClick={() => setMode("join")}
              disabled={busy}
            >
              New group
            </button>
            <button
              role="tab"
              aria-selected={!isJoin}
              className={"auth-mode-tab" + (!isJoin ? " auth-mode-tab-active" : "")}
              onClick={() => setMode("signin")}
              disabled={busy}
            >
              Already have an account
            </button>
          </div>

          <label className="field">
            Group code
            <input
              value={groupSlug}
              onChange={(e) => setGroupSlug(e.target.value)}
              onKeyDown={onEnter}
              placeholder="e.g. hillcrest"
              autoComplete="organization"
              autoFocus
              disabled={busy}
            />
          </label>

          {isJoin ? (
            <>
              <label className="field">
                Full name
                <input
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  onKeyDown={onEnter}
                  placeholder="e.g. Harriet Banda"
                  autoComplete="name"
                  disabled={busy}
                />
              </label>
              <label className="field">
                Phone number
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={onEnter}
                  placeholder="e.g. 097 123 4567"
                  autoComplete="tel"
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
            </>
          ) : (
            <label className="field">
              Name or phone number
              <input
                value={signinIdentifier}
                onChange={(e) => setSigninIdentifier(e.target.value)}
                onKeyDown={onEnter}
                placeholder="e.g. Harriet or 097 123 4567"
                autoComplete="username"
                disabled={busy}
              />
            </label>
          )}

          <label className="field">
            PIN (4+ digits)
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={onEnter}
              placeholder="••••"
              autoComplete={isJoin ? "new-password" : "current-password"}
              disabled={busy}
            />
          </label>

          {isJoin && (
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
          )}

          {error && <div className="error-text" role="alert" aria-live="assertive">{error}</div>}
          <button className="btn-primary" disabled={!canSubmit || busy} onClick={submit}>
            {busy ? "Checking…" : isJoin ? "Join group" : "Continue"}
          </button>
        </div>

        {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
        {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
      </div>
    </div>
  );
}
