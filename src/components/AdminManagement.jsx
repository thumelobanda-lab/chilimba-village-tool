import React, { useState } from "react";
import { getGroupMembers, promoteMember, demoteMember, removeMember, resetMemberPin } from "../lib/api.js";
import { useApiData } from "../lib/useApiData.js";

const money = (n) => "K" + (Number(n) || 0).toLocaleString("en-ZM", { maximumFractionDigits: 0 });

// There's no push/badge/notification anywhere else when someone joins —
// this tag, plus the roster now sorting newest-first (see the ORDER BY
// in worker/src/routes/admin.js and the mock-mode sort above it), is the
// whole mechanism for an admin to notice a new member without having to
// remember exactly who was on the roster last time they looked.
const NEW_MEMBER_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours
function isNewMember(joinedAt) {
  if (!joinedAt) return false;
  return Date.now() - new Date(joinedAt).getTime() < NEW_MEMBER_WINDOW_MS;
}

export default function AdminManagement() {
  const { data, error: loadError, loading, refresh } = useApiData(getGroupMembers, []);
  // Selectable, not free-text — picking straight from the real roster
  // rules out typos or promoting the wrong person entirely, rather than
  // just reducing the risk. Already-admin members are excluded since
  // promoting one again is a no-op.
  const promotableMembers = (data?.members || []).filter((m) => m.role !== "admin");
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

  const handleResetPin = async (name) => {
    if (!window.confirm(`Reset ${name}'s PIN? They'll be signed out everywhere and will set a new PIN the next time they sign in.`)) return;
    setActionError("");
    setBusy(true);
    try {
      await resetMemberPin(name);
      setStatus(`${name}'s PIN was reset`);
    } catch (e) {
      setActionError(e.message || "Could not reset that member's PIN.");
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(""), 2500);
    }
  };

  return (
    <div style={{ marginTop: 20 }}>
      <h3 className="panel-subtitle">Roster & Admins</h3>
      <p className="muted tiny" style={{ marginBottom: 10 }}>
        Every active member, newest-joined first, tagged "new" for their first 48 hours so
        a fresh sign-up doesn't get missed — this is the only place that shows one. Any
        admin can promote another member, demote another admin (the group is never
        left without at least one), remove a member entirely (keeps their payment history,
        just revokes access), or reset a member's PIN if they've forgotten it — PINs are
        one-way hashed, so this is the only recovery path. To remove an admin, demote them
        first.
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
                    <td className="al">
                      {m.name}
                      {isNewMember(m.joinedAt) && <span className="tag">new</span>}
                    </td>
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
                      <button
                        className="btn-link"
                        style={{ marginRight: 10 }}
                        disabled={busy}
                        onClick={() => handleResetPin(m.name)}
                      >
                        reset PIN
                      </button>
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
              Promote a member
              {promotableMembers.length === 0 ? (
                <span className="muted small">Everyone here is already an admin.</span>
              ) : (
                <select
                  value={promoteName}
                  onChange={(e) => setPromoteName(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Select a member…</option>
                  {promotableMembers.map((m) => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              )}
            </label>
            <button className="btn-ghost-dark" disabled={busy || !promoteName} onClick={handlePromote}>
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
