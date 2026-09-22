import React, { useEffect, useState } from "react";
import TermsModal from "./TermsModal.jsx";
import PrivacyModal from "./PrivacyModal.jsx";
import OpenBookMark from "./OpenBookMark.jsx";
import TitleSelect, { isTitleError, TITLE_FIELD_ERROR } from "./TitleSelect.jsx";

const LAST_GROUP_KEY = "chilimba:last-group-slug";

// Reads ?join=<slug> from the URL — the format InviteCard.jsx's share
// link now uses (see buildJoinUrl in inviteCard.js). Its presence is
// what tells this screen someone arrived via an invite rather than
// typing the app's URL in from memory, so it can default them into
// "Sign up > Join a group" with the code already filled in instead of
// a generic combined form that doesn't say what they're supposed to do.
function getInviteSlugFromUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("join") || "";
}

// Fully static — no entrance effects, no hero motion, no tab-switch
// animation. Every mode change below is a plain state swap with no
// transition, by design (see CLAUDE.md's Part 3 ground rules for why:
// this is the one screen every visitor hits before anything else has
// loaded, so it stays instant and predictable rather than performing).
export default function Login({ onLogin, onJoin, onCreateGroup, onOwnerLogin, sessionEndedNotice }) {
  const [inviteSlug] = useState(getInviteSlugFromUrl);
  // Top-level tab.
  const [mode, setMode] = useState(inviteSlug ? "signup" : "signin"); // "signup" | "signin"
  // Sign up's own compact switch — "Create a group" replaces what used
  // to be a separate, admin-gated "Owner" tab. Any old link/state that
  // pointed at that tab now lands here instead of on a dead mode.
  const [signupMode, setSignupMode] = useState("join"); // "join" | "create"
  // Sign in's own switch — folds the platform owner's separate
  // higher-privilege credential (real email + password, not a group
  // code + PIN) into this one tab instead of giving it a tab of its own.
  const [signinMode, setSigninMode] = useState("group"); // "group" | "owner"

  const [groupSlug, setGroupSlug] = useState(
    () => inviteSlug || localStorage.getItem(LAST_GROUP_KEY) || ""
  );
  // Separate state per mode rather than one shared "name" field — join
  // and sign-in ask genuinely different questions (full name vs.
  // name-or-phone), so switching modes shouldn't leave one mode's input
  // sitting in the other's field.
  const [joinName, setJoinName] = useState("");
  const [phone, setPhone] = useState("");
  // Optional — used only for greeting phrasing (dashboardMath.js's
  // titledAddress), never validated against/required the way name and
  // phone are. "" (not asked yet) is a valid, permanent choice, not just
  // an in-progress state — see normalizeTitle in lib/api/auth.js, which
  // treats it the same as never having answered. Deliberately never used
  // to set gender — see normalizeTitle vs. normalizeGender in
  // worker/src/auth.js for why the two are kept separate. Shared between
  // Join and Create since only one of the two is ever visible at once.
  const [title, setTitle] = useState("");
  const [groupName, setGroupName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [signinIdentifier, setSigninIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [error, setError] = useState("");
  const [titleError, setTitleError] = useState("");
  const [busy, setBusy] = useState(false);
  // Join and Create both mean "a new member/admin registering" — shared
  // since only one is ever visible at once. Sign in isn't, so this never
  // gates that tab's submit button, and deliberately starts unchecked
  // (not pre-checked) every time.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

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

  const isSignup = mode === "signup";
  const isJoin = isSignup && signupMode === "join";
  const isCreate = isSignup && signupMode === "create";
  const isOwner = !isSignup && signinMode === "owner";
  const canSubmit = isJoin
    ? !!(groupSlug.trim() && joinName.trim() && phone.trim() && termsAccepted)
    : isCreate
    ? !!(groupName.trim() && adminName.trim() && termsAccepted)
    : isOwner
    ? !!(ownerEmail.trim() && ownerPassword)
    : !!(groupSlug.trim() && signinIdentifier.trim());

  const submit = async () => {
    setError("");
    setTitleError("");
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      if (isJoin) {
        await onJoin(groupSlug.trim(), joinName.trim(), phone.trim(), pin, termsAccepted, title);
        localStorage.setItem(LAST_GROUP_KEY, groupSlug.trim().toLowerCase());
      } else if (isCreate) {
        await onCreateGroup({ groupName: groupName.trim(), adminName: adminName.trim(), pin, termsAccepted, title });
      } else if (isOwner) {
        await onOwnerLogin(ownerEmail.trim(), ownerPassword);
      } else {
        await onLogin(groupSlug.trim(), signinIdentifier.trim(), pin);
        localStorage.setItem(LAST_GROUP_KEY, groupSlug.trim().toLowerCase());
      }
    } catch (e) {
      if (isTitleError(e)) setTitleError(TITLE_FIELD_ERROR);
      else setError(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const onEnter = (e) => e.key === "Enter" && submit();

  return (
    <div className="login-screen">
      <img
        className="login-hero-bg"
        src="/images/login-hero-600.webp"
        srcSet="/images/login-hero-600.webp 600w, /images/login-hero.webp 800w"
        sizes="100vw"
        width={600}
        height={443}
        loading="eager"
        alt="A river at sunset, framed by trees"
      />
      <div className="login-hero-scrim" aria-hidden="true" />

      <div className="login-content">
        <div className="login-top">
          <OpenBookMark />
          <p className="login-tagline">Your group's honest record.</p>
        </div>

        <div className="login-form">
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
              aria-selected={isSignup}
              className={"auth-mode-tab" + (isSignup ? " auth-mode-tab-active" : "")}
              onClick={() => setMode("signup")}
              disabled={busy}
            >
              Sign up
            </button>
            <button
              role="tab"
              aria-selected={!isSignup}
              className={"auth-mode-tab" + (!isSignup ? " auth-mode-tab-active" : "")}
              onClick={() => setMode("signin")}
              disabled={busy}
            >
              Sign in
            </button>
          </div>

          {isSignup && (
            <div
              className="auth-mode-toggle auth-submode-toggle"
              role="tablist"
              aria-label="Join a group or create a group"
            >
              <button
                role="tab"
                aria-selected={isJoin}
                className={"auth-mode-tab" + (isJoin ? " auth-mode-tab-active" : "")}
                onClick={() => setSignupMode("join")}
                disabled={busy}
              >
                Join a group
              </button>
              <button
                role="tab"
                aria-selected={isCreate}
                className={"auth-mode-tab" + (isCreate ? " auth-mode-tab-active" : "")}
                onClick={() => setSignupMode("create")}
                disabled={busy}
              >
                Create a group
              </button>
            </div>
          )}

          {isJoin && (
            <>
              <label className="field">
                Group code
                <input
                  value={groupSlug}
                  onChange={(e) => setGroupSlug(e.target.value)}
                  onKeyDown={onEnter}
                  autoComplete="organization"
                  autoFocus
                  disabled={busy}
                />
              </label>
              <label className="field">
                Full name
                <input
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  onKeyDown={onEnter}
                  autoComplete="name"
                  disabled={busy}
                />
              </label>
              <label className="field">
                Phone
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={onEnter}
                  autoComplete="tel"
                  disabled={busy}
                />
              </label>
              <label className="field">
                Title
                <TitleSelect value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
              </label>
              {titleError && <div className="error-text" role="alert">{titleError}</div>}
              <label className="field">
                PIN
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
            </>
          )}

          {isCreate && (
            <>
              <label className="field">
                Group name
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  onKeyDown={onEnter}
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
                  autoComplete="name"
                  disabled={busy}
                />
              </label>
              <label className="field">
                Title
                <TitleSelect value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
              </label>
              {titleError && <div className="error-text" role="alert">{titleError}</div>}
              <label className="field">
                PIN
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
            </>
          )}

          {!isSignup && (
            <>
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
                      autoComplete="organization"
                      autoFocus
                      disabled={busy}
                    />
                  </label>
                  <label className="field">
                    Name or phone
                    <input
                      value={signinIdentifier}
                      onChange={(e) => setSigninIdentifier(e.target.value)}
                      onKeyDown={onEnter}
                      autoComplete="username"
                      disabled={busy}
                    />
                  </label>
                  <label className="field">
                    PIN
                    <input
                      type="password"
                      inputMode="numeric"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      onKeyDown={onEnter}
                      placeholder="••••"
                      autoComplete="current-password"
                      disabled={busy}
                    />
                  </label>
                </>
              )}
              <button
                type="button"
                className="btn-link"
                style={{ display: "block", marginBottom: 14 }}
                onClick={() => setSigninMode(isOwner ? "group" : "owner")}
                disabled={busy}
              >
                {isOwner ? "Sign in to a group instead" : "Platform owner? Sign in here"}
              </button>
            </>
          )}

          {error && <div className="error-text" role="alert" aria-live="assertive">{error}</div>}
          <button className="btn-primary" disabled={!canSubmit || busy} onClick={submit}>
            {busy ? "Working…" : isJoin ? "Join group" : isCreate ? "Create group" : isOwner ? "Sign in" : "Continue"}
          </button>
        </div>
      </div>

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    </div>
  );
}
