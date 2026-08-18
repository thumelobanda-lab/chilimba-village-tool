import React, { useState } from "react";
import { getGroupMembers, promoteMember, demoteMember, removeMember } from "../lib/api.js";
import { useApiData } from "../lib/useApiData.js";

const money = (n) => "K" + (Number(n) || 0).toLocaleString("en-ZM", { maximumFractionDigits: 0 });

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

  const handleRemove = async (name) => {
    if (!window.confirm(`Remove ${name} from the group? They'll no longer be able to log in. Their payment history is kept.`)) return;
    setActionError("");
    setBusy(true);
    try {
      await removeMember(name);
      await refresh();
    } catch (e) {
      setActionError(e.message || "Could not remove that member.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 20 }}>
      <h3 className="panel-subtitle">Roster & Admins</h3>
      <p className="muted tiny" style={{ marginBottom: 10 }}>
        Every active member, when they joined, and the next date they still owe something
        on. Any admin can promote another member, demote another admin (the group is never
        left without at least one), or remove a member entirely — removing keeps their
        payment history, it just revokes access. To remove an admin, demote them first.
      </p>

      {loading && !data && <p className="muted small" aria-live="polite">Loading…</p>}
      {loadError && !data && <div className="error-text" role="alert">{loadError}</div>}

      {data && (
        <>
          <div className="grid-wrap">
            <table className="grid-table">
              <thead>
                <tr>
                  <th className="al">Name</th>
                  <th className="al">Role</th>
                  <th className="al">Joined</th>
                  <th className="al">Next Due</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.name}>
                    <td className="al">{m.name}</td>
                    <td className="al">
                      {m.role === "admin" ? <span className="tag tag-rate">admin</span> : <span className="muted tiny">member</span>}
                    </td>
                    <td className="al muted small">
                      {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="al small">
                      {m.nextDueDate
                        ? <>{m.nextDueDate} <span className="muted tiny">({money(m.nextDueAmount)})</span></>
                        : <span className="muted tiny">settled</span>}
                    </td>
                    <td>
                      {m.role === "admin" ? (
                        <button className="btn-link" disabled={busy} onClick={() => handleDemote(m.name)}>demote</button>
                      ) : (
                        <button className="btn-link" disabled={busy} onClick={() => handleRemove(m.name)}>remove</button>
                      )}
                    </td>
                  </tr>
                ))}
                {data.members.length === 0 && (
                  <tr><td colSpan={5} className="muted small">No members yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="field-row" style={{ alignItems: "flex-end", marginTop: 12 }}>
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
