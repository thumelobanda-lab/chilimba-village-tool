import React, { useEffect, useState } from "react";
import TermsModal from "./TermsModal.jsx";
import CreateGroup from "./CreateGroup.jsx";
import LoginScene from "./LoginScene.jsx";
import { MOCK_MODE } from "../lib/api/core.js";

const LAST_GROUP_KEY = "chilimba:last-group-slug";

// Production group creation is intentionally admin-gated (see App.jsx's
// "creategroup" tab) — a fresh, logged-out browser has no self-service way
// to create the very first group, by design. That's a chicken-and-egg
// problem for local testing only: a brand-new mock-mode browser has no
// group to sign into yet either. `import.meta.env.DEV` is statically
// replaced with the literal `false` by Vite for a production build (`npm
// run build`), so this condition is always false there and the shortcut
// below can never render or execute outside `npm run dev`. Also requires
// MOCK_MODE so it can't fire against a real deployed Worker if someone
// points a local dev server at one.
const DEV_CREATE_GROUP_ENABLED = import.meta.env.DEV && MOCK_MODE;

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

export default function Login({ onLogin, onJoin, onCreateGroup, onOwnerLogin, sessionEndedNotice }) {
  const [inviteSlug] = useState(getInviteSlugFromUrl);
  const [mode, setMode] = useState(inviteSlug ? "join" : "signin"); // "join" | "signin" | "owner" | "devCreateGroup"
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
  // Owner sign-in is a structurally different credential (real email +
  // password, not a group code + PIN) — see onOwnerLogin below — so it
  // gets its own fields rather than being squeezed into groupSlug/pin.
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
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
  const isOwner = mode === "owner";
  const canSubmit = isOwner
    ? !!(ownerEmail.trim() && ownerPassword)
    : isJoin
    ? !!(groupSlug.trim() && joinName.trim() && phone.trim() && termsAccepted)
    : !!(groupSlug.trim() && signinIdentifier.trim());

  const submit = async () => {
    setError("");
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      if (isOwner) {
        await onOwnerLogin(ownerEmail.trim(), ownerPassword);
        return;
      }
      if (isJoin) {
        await onJoin(groupSlug.trim(), joinName.trim(), phone.trim(), pin, termsAccepted);
      } else {
        await onLogin(groupSlug.trim(), signinIdentifier.trim(), pin);
      }
      localStorage.setItem(LAST_GROUP_KEY, groupSlug.trim().toLowerCase());
    } catch (e) {
      setError(e.message || (isOwner ? "Could not sign in." : isJoin ? "Could not join." : "Could not sign in."));
    } finally {
      setBusy(false);
    }
  };

  const onEnter = (e) => e.key === "Enter" && submit();

  // Early return, not a branch inside the main panel below — CreateGroup
  // renders its own "panel login-panel" wrapper, so nesting it inside this
  // component's would double up the panel chrome.
  if (mode === "devCreateGroup" && DEV_CREATE_GROUP_ENABLED) {
    return <CreateGroup onCreate={onCreateGroup} onBackToLogin={() => setMode("signin")} />;
  }

  return (
    <div className="panel login-panel">
      <LoginScene />
      <p className="login-tagline">Your group's honest record.</p>
      {sessionEndedNotice && (
        <div className="error-text" role="alert" style={{ marginBottom: 14 }}>
          Your session ended — this can happen if your access changed (e.g. you were
          promoted or removed) while you were signed in elsewhere. Sign in again to
          continue with your current access.
        </div>
      )}
      <div className="auth-mode-toggle" role="tablist" aria-label="Sign up, sign in, or owner sign-in">
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
          aria-selected={!isJoin && !isOwner}
          className={"auth-mode-tab" + (!isJoin && !isOwner ? " auth-mode-tab-active" : "")}
          onClick={() => setMode("signin")}
          disabled={busy}
        >
          Sign in
        </button>
        <button
          role="tab"
          aria-selected={isOwner}
          className={"auth-mode-tab" + (isOwner ? " auth-mode-tab-active" : "")}
          onClick={() => setMode("owner")}
          disabled={busy}
        >
          Owner
        </button>
      </div>

      {DEV_CREATE_GROUP_ENABLED && (
        <button
          type="button"
          className="btn-link"
          style={{
            display: "block",
            margin: "0 0 14px",
            fontSize: 12,
            border: "1px dashed #999",
            borderRadius: 6,
            padding: "6px 10px",
          }}
          onClick={() => setMode("devCreateGroup")}
          disabled={busy}
        >
          🛠 DEV ONLY — create a new group for local testing (never shown in production)
        </button>
      )}

      {isJoin ? (
        <>
          <h2 className="panel-title">New here? Join your group</h2>
          <p className="muted small" style={{ marginBottom: 14 }}>
            First time? Enter the group code your group leader shared with you, your name and
            phone number, and set a PIN.
          </p>
        </>
      ) : isOwner ? (
        <>
          <h2 className="panel-title">Owner sign in</h2>
          <p className="muted small" style={{ marginBottom: 14 }}>
            Not a group login — this is a separate, higher-privilege platform account.
            There's no self-service way to create one — see scripts/create-owner.sh.
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

      {isOwner ? (
        <>
          <label className="field">
            Email
            <input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              onKeyDown={onEnter}
              autoComplete="username"
              autoFocus
              disabled={busy}
            />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              value={ownerPassword}
              onChange={(e) => setOwnerPassword(e.target.value)}
              onKeyDown={onEnter}
              autoComplete="current-password"
              disabled={busy}
            />
          </label>
        </>
      ) : (
        <>
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
          {!isJoin && (
            <button
              type="button"
              className="btn-link"
              disabled
              title="Self-service PIN reset by SMS is coming soon."
              style={{ marginBottom: 14 }}
            >
              Forgot your PIN? (coming soon — ask a group leader for now)
            </button>
          )}
        </>
      )}
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
        {busy ? "Checking…" : isOwner ? "Sign in" : isJoin ? "Join group" : "Continue"}
      </button>

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}

      {isOwner ? (
        <p className="muted tiny">
          Your password is never stored or sent in plain text — only a one-way hash of it
          is checked.
        </p>
      ) : isJoin ? (
        <p className="muted tiny">
          Your phone number is kept private — it's never shown to other members — and
          lets you sign in with it later, plus enables a PIN-reset option down the road,
          since a PIN can't be recovered once forgotten. Your PIN itself is never stored
          or sent in plain text, only a one-way hash of it is checked.
        </p>
      ) : (
        <p className="muted tiny">
          Your PIN is never stored or sent in plain text — only a one-way hash of it is
          checked. If your group doesn't have a code yet, ask its group leader — starting a
          brand-new Chilimba group is a group leader action from inside the app now, not
          something reachable from here.
        </p>
      )}
    </div>
  );
}
