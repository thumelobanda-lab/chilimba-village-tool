import React, { useEffect, useState } from "react";
import TermsModal from "./TermsModal.jsx";

const LAST_GROUP_KEY = "chilimba:last-group-slug";

// Reads ?join=<slug> from the URL — the format InviteCard.jsx's share
// link now uses (see buildJoinUrl in inviteCard.js). Its presence is
// what tells this screen someone arrived via an invite rather than
// typing the app's URL in from memory, so it can default them into
// "Sign up" mode with the code already filled in instead of a generic
// combined form that doesn't say what they're supposed to do.
function getInviteSlugFromUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("join") || "";
}

export default function Login({ onLogin, onJoin, sessionEndedNotice }) {
  const [inviteSlug] = useState(getInviteSlugFromUrl);
  const [mode, setMode] = useState(inviteSlug ? "join" : "signin"); // "join" | "signin"
  const [groupSlug, setGroupSlug] = useState(
    () => inviteSlug || localStorage.getItem(LAST_GROUP_KEY) || ""
  );
  // Separate state per mode rather than one shared "name" field — sign
  // up and sign in ask genuinely different questions (full name vs.
  // name-or-phone), so switching modes shouldn't leave one mode's input
  // sitting in the other's field.
  const [joinName, setJoinName] = useState("");
  const [phone, setPhone] = useState("");
  const [signinIdentifier, setSigninIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Only sign-up needs this — signing in isn't "a new member/admin
  // registering", so this never gates the sign-in submit button, and
  // deliberately starts unchecked (not pre-checked) every time.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Drop ?join=... from the address bar once it's been read, so it
  // doesn't linger there or get shared/bookmarked with someone else's
  // group code baked in.
  useEffect(() => {
    if (inviteSlug && window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.delete("join");
      window.history.replaceState({}, "", url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        await onJoin(groupSlug.trim(), joinName.trim(), phone.trim(), pin, termsAccepted);
      } else {
        await onLogin(groupSlug.trim(), signinIdentifier.trim(), pin);
      }
      localStorage.setItem(LAST_GROUP_KEY, groupSlug.trim().toLowerCase());
    } catch (e) {
      setError(e.message || (isJoin ? "Could not join." : "Could not sign in."));
    } finally {
      setBusy(false);
    }
  };

  const onEnter = (e) => e.key === "Enter" && submit();

  return (
    <div className="panel login-panel">
      {sessionEndedNotice && (
        <div className="error-text" role="alert" style={{ marginBottom: 14 }}>
          Your session ended — this can happen if your access changed (e.g. you were
          promoted or removed) while you were signed in elsewhere. Sign in again to
          continue with your current access.
        </div>
      )}
      <div className="auth-mode-toggle" role="tablist" aria-label="Sign up or sign in">
        <button
          role="tab"
          aria-selected={isJoin}
          className={"auth-mode-tab" + (isJoin ? " auth-mode-tab-active" : "")}
          onClick={() => setMode("join")}
          disabled={busy}
        >
          Sign up
        </button>
        <button
          role="tab"
          aria-selected={!isJoin}
          className={"auth-mode-tab" + (!isJoin ? " auth-mode-tab-active" : "")}
          onClick={() => setMode("signin")}
          disabled={busy}
        >
          Sign in
        </button>
      </div>

      {isJoin ? (
        <>
          <h2 className="panel-title">New here? Join your group</h2>
          <p className="muted small" style={{ marginBottom: 14 }}>
            First time? Enter the group code your admin shared with you, your name and
            phone number, and set a PIN.
          </p>
        </>
      ) : (
        <>
          <h2 className="panel-title">Welcome back — Sign in</h2>
          <p className="muted small" style={{ marginBottom: 14 }}>
            Already joined? Enter your name or phone number and PIN to access your group.
          </p>
        </>
      )}

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
          </button>
        </label>
      )}

      {error && <div className="error-text" role="alert" aria-live="assertive">{error}</div>}
      <button className="btn-primary" disabled={!canSubmit || busy} onClick={submit}>
        {busy ? "Checking…" : isJoin ? "Join group" : "Continue"}
      </button>

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}

      {isJoin ? (
        <p className="muted tiny">
          Your phone number is kept private — it's never shown to other members — and
          lets you sign in with it later, plus enables a PIN-reset option down the road,
          since a PIN can't be recovered once forgotten. Your PIN itself is never stored
          or sent in plain text, only a one-way hash of it is checked.
        </p>
      ) : (
        <p className="muted tiny">
          Your PIN is never stored or sent in plain text — only a one-way hash of it is
          checked. If your group doesn't have a code yet, ask its admin — starting a
          brand-new Chilimba group is an admin action from inside the app now, not
          something reachable from here.
        </p>
      )}
    </div>
  );
}
