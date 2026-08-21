import React, { useState } from "react";
import { ownerLogin } from "../../lib/api/owner.js";

/**
 * The platform-owner sign-in screen — a real email + password, not a
 * group code + PIN. Nothing here shares any code path with group
 * login/signup (see OwnerApp.jsx and lib/api/owner.js): this is a
 * structurally separate credential, not just a different form.
 */
export default function OwnerLogin({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    if (!email.trim() || !password) return;
    setBusy(true);
    try {
      const session = await ownerLogin(email.trim(), password);
      onSignedIn(session);
    } catch (e) {
      setError(e.message || "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  const onEnter = (e) => e.key === "Enter" && submit();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <div className="brand">Chilimba Circle — Platform Owner</div>
          <div className="muted small">Not a group login — this is a separate, higher-privilege account.</div>
        </div>
      </header>
      <main className="app-main">
        <div className="panel login-panel">
          <h2 className="panel-title">Owner sign in</h2>
          <label className="field">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onEnter}
              autoComplete="current-password"
              disabled={busy}
            />
          </label>
          {error && <div className="error-text" role="alert" aria-live="assertive">{error}</div>}
          <button className="btn-primary" disabled={busy || !email.trim() || !password} onClick={submit}>
            {busy ? "Checking…" : "Sign in"}
          </button>
          <p className="muted tiny">
            There's no self-service way to create an owner account — see scripts/create-owner.sh.
          </p>
        </div>
      </main>
    </div>
  );
}
