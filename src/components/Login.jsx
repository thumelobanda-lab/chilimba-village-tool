import React, { useState } from "react";

const LAST_GROUP_KEY = "chilimba:last-group-slug";

export default function Login({ onLogin }) {
  const [groupSlug, setGroupSlug] = useState(() => localStorage.getItem(LAST_GROUP_KEY) || "");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="panel login-panel">
      <h2 className="panel-title">Sign in</h2>
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
          autoComplete="current-password"
          disabled={busy}
        />
      </label>
      {error && <div className="error-text" role="alert" aria-live="assertive">{error}</div>}
      <button className="btn-primary" disabled={!groupSlug.trim() || !name.trim() || busy} onClick={submit}>
        {busy ? "Checking…" : "Continue"}
      </button>
      <p className="muted tiny">
        First time signing in with this name sets your PIN. Your PIN is never stored
        or sent in plain text — only a one-way hash of it is checked. If your group
        doesn't have a code yet, ask its admin — starting a brand-new Chilimba group is
        an admin action now, not something anyone can do from here.
      </p>
    </div>
  );
}
