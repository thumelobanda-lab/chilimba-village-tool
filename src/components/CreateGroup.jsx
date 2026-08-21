import React, { useState } from "react";

export default function CreateGroup({ onCreate, onBackToLogin }) {
  const [groupName, setGroupName] = useState("");
  const [slug, setSlug] = useState("");
  const [adminName, setAdminName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const normalizeSlugInput = (value) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const suggestSlug = (name) => {
    setGroupName(name);
    if (!slug) setSlug(normalizeSlugInput(name));
  };

  const submit = async () => {
    setError("");
    if (busy) return;
    if (!groupName.trim() || !slug.trim() || !adminName.trim()) {
      setError("Fill in the group name, group code, and your name.");
      return;
    }
    setBusy(true);
    try {
      await onCreate({ slug: slug.trim(), groupName: groupName.trim(), adminName: adminName.trim(), pin });
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
        You'll be the group's first admin — you can promote a co-admin later by asking
        them to sign up, then setting their role directly in the database.
      </p>

      <label className="field">
        Group name
        <input
          value={groupName}
          onChange={(e) => suggestSlug(e.target.value)}
          onKeyDown={onEnter}
          placeholder="e.g. Hillcrest Chilimba"
          autoComplete="organization"
          autoFocus
          disabled={busy}
        />
      </label>
      <label className="field">
        Group code (what members type to sign in)
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          onBlur={(e) => setSlug(normalizeSlugInput(e.target.value))}
          onKeyDown={onEnter}
          placeholder="e.g. hillcrest"
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

      {error && <div className="error-text" role="alert" aria-live="assertive">{error}</div>}

      <button className="btn-primary" disabled={busy} onClick={submit}>
        {busy ? "Creating…" : "Create group"}
      </button>
      {onBackToLogin && (
        <button className="btn-link" style={{ display: "block", margin: "10px auto 0" }} onClick={onBackToLogin} disabled={busy}>
          Already have a group code? Sign in instead
        </button>
      )}
    </div>
  );
}
