import React, { useState } from "react";
import { getGroupMembers, promoteMember, demoteMember } from "../lib/api.js";
import { useApiData } from "../lib/useApiData.js";

export default function AdminManagement() {
  const { data, error: loadError, loading, refresh } = useApiData(getGroupMembers, []);
  const [promoteName, setPromoteName] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [status, setStatus] = useState("");

  const handlePromote = async () => {
    setActionError("");
    if (!promoteName.trim()) return;
    setBusy(true);
    try {
      await promoteMember(promoteName.trim());
      setPromoteName("");
      setStatus("Promoted");
      await refresh();
    } catch (e) {
      setActionError(e.message || "Could not promote that member.");
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(""), 1500);
    }
  };

  const handleDemote = async (name) => {
    if (!window.confirm(`Remove admin access from ${name}?`)) return;
    setActionError("");
    setBusy(true);
    try {
      await demoteMember(name);
      await refresh();
    } catch (e) {
      setActionError(e.message || "Could not demote that member.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 20 }}>
      <h3 className="panel-subtitle">Admins</h3>
      <p className="muted tiny" style={{ marginBottom: 10 }}>
        Any existing admin can promote another member of this group — the group is never
        left without at least one. Promoting the first admin of a brand-new group only
        happens when that group is created.
      </p>

      {loading && !data && <p className="muted small" aria-live="polite">Loading…</p>}
      {loadError && !data && <div className="error-text" role="alert">{loadError}</div>}

      {data && (
        <>
          <div className="feed-list" style={{ marginBottom: 12 }}>
            {data.members.map((m) => (
              <div className="feed-item" key={m.name}>
                <span className="feed-name">{m.name}</span>
                {m.role === "admin" ? (
                  <>
                    <span className="tag tag-rate">admin</span>
                    <button className="btn-link" disabled={busy} onClick={() => handleDemote(m.name)}>
                      remove admin
                    </button>
                  </>
                ) : (
                  <span className="muted tiny">member</span>
                )}
              </div>
            ))}
            {data.members.length === 0 && <p className="muted small">No members yet.</p>}
          </div>

          <div className="field-row" style={{ alignItems: "flex-end" }}>
            <label className="field">
              Promote a member by name
              <input
                value={promoteName}
                onChange={(e) => setPromoteName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePromote()}
                placeholder="e.g. Doreen"
                disabled={busy}
              />
            </label>
            <button className="btn-ghost-dark" disabled={busy || !promoteName.trim()} onClick={handlePromote}>
              Promote
            </button>
            <span className="muted small" aria-live="polite">{status}</span>
          </div>

          {actionError && <div className="error-text" role="alert" style={{ marginTop: 8 }}>{actionError}</div>}
        </>
      )}
    </div>
  );
}
