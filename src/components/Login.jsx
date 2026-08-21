import React, { useEffect, useState } from "react";

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

export default function Login({ onLogin, sessionEndedNotice }) {
  const [inviteSlug] = useState(getInviteSlugFromUrl);
  const [mode, setMode] = useState(inviteSlug ? "join" : "signin"); // "join" | "signin"
  const [groupSlug, setGroupSlug] = useState(
    () => inviteSlug || localStorage.getItem(LAST_GROUP_KEY) || ""
  );
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  const submit = async () => {
    setError("");
    if (!groupSlug.trim() || !name.trim() || busy) return;
    setBusy(true);
    try {
      await onLogin(groupSlug.trim(), name.trim(), pin);
      localStorage.setItem(LAST_GROUP_KEY, groupSlug.trim().toLowerCase());
    } catch (e) {
      setError(e.message || "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  const onEnter = (e) => e.key === "Enter" && submit();
  const isJoin = mode === "join";

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
            First time? Enter the group code your admin shared with you, choose your name,
            and set a PIN.
          </p>
        </>
      ) : (
        <>
          <h2 className="panel-title">Welcome back — Sign in</h2>
          <p className="muted small" style={{ marginBottom: 14 }}>
            Already joined? Enter your name and PIN to access your group.
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
      <label className="field">
        Your name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onEnter}
          placeholder="e.g. Harriet"
          autoComplete="username"
          disabled={busy}
        />
      </label>
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
      {error && <div className="error-text" role="alert" aria-live="assertive">{error}</div>}
      <button className="btn-primary" disabled={!groupSlug.trim() || !name.trim() || busy} onClick={submit}>
        {busy ? "Checking…" : isJoin ? "Join group" : "Continue"}
      </button>

      {isJoin ? (
        <p className="muted tiny">
          Your PIN is never stored or sent in plain text — only a one-way hash of it is
          checked.
        </p>
      ) : (
        <p className="muted tiny">
          First time signing in with a name sets its PIN, same as joining. Your PIN is
          never stored or sent in plain text — only a one-way hash of it is checked. If
          your group doesn't have a code yet, ask its admin — starting a brand-new
          Chilimba group is an admin action from inside the app now, not something
          reachable from here.
        </p>
      )}
    </div>
  );
}
