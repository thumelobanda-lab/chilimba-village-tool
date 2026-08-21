import React, { useEffect, useState, useCallback } from "react";
import {
  getOwnerOverview, getOwnerGroups, getPendingSubscriptions,
  confirmSubscription, rejectSubscription, suspendGroup, unsuspendGroup, ownerLogout,
} from "../../lib/api/owner.js";
import OwnerMessaging from "./OwnerMessaging.jsx";

const money = (n) => "K" + (Number(n) || 0).toLocaleString("en-ZM", { maximumFractionDigits: 0 });

export default function OwnerDashboard({ session, onSignedOut }) {
  const [overview, setOverview] = useState(null);
  const [groups, setGroups] = useState(null);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [ov, gr, pd] = await Promise.all([getOwnerOverview(), getOwnerGroups(), getPendingSubscriptions()]);
      setOverview(ov);
      setGroups(gr.groups);
      setPending(pd.pending);
    } catch (e) {
      setError(e.message || "Could not load the dashboard.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleLogout = () => {
    ownerLogout();
    onSignedOut();
  };

  const doConfirm = async (id) => {
    setBusyId(id);
    try {
      await confirmSubscription(id);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const doReject = async (id) => {
    const notes = window.prompt("Reason for rejecting this payment claim (optional):", "") || "";
    setBusyId(id);
    try {
      await rejectSubscription(id, notes);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const doSuspend = async (group) => {
    const reason = window.prompt(`Reason for suspending "${group.groupName}"?`, "");
    if (!reason || !reason.trim()) return;
    setBusyId(group.id);
    try {
      await suspendGroup(group.id, reason.trim());
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const doUnsuspend = async (group) => {
    setBusyId(group.id);
    try {
      await unsuspendGroup(group.id);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <div className="brand">Chilimba Circle — Platform Owner</div>
          <div className="muted small">{session.email}</div>
        </div>
        <div className="header-right">
          <button className="btn-ghost" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <main className="app-main">
        {error && <div className="error-text" role="alert" style={{ marginBottom: 14 }}>{error}</div>}

        {overview && (
          <div className="calc-grid" style={{ marginBottom: 20 }}>
            <div className="card"><div className="card-label">Total Groups</div><div className="card-value">{overview.totalGroups}</div></div>
            <div className="card"><div className="card-label">Premium / Free</div><div className="card-value">{overview.premiumCount} / {overview.freeCount}</div></div>
            <div className="card card-highlight"><div className="card-label">Confirmed Revenue</div><div className="card-value">{money(overview.confirmedRevenue)}</div></div>
            <div className={"card" + (overview.pendingCount > 0 ? " card-warn" : "")}>
              <div className="card-label">Pending Payment Claims</div><div className="card-value">{overview.pendingCount}</div>
            </div>
            <div className={"card" + (overview.suspendedCount > 0 ? " card-warn" : "")}>
              <div className="card-label">Suspended Groups</div><div className="card-value">{overview.suspendedCount}</div>
            </div>
          </div>
        )}

        {overview && overview.fraudSignals.length > 0 && (
          <div className="panel">
            <h2 className="panel-title">Fraud Signals</h2>
            <p className="muted small" style={{ marginBottom: 12 }}>
              The same IP address or creator phone number was used to create more than one
              group within a short window — not proof of anything by itself, worth a look.
            </p>
            <div className="feed-list">
              {overview.fraudSignals.map((s, i) => (
                <div className="feed-item" key={i}>
                  <span className="feed-name">{s.type === "ip" ? "Shared IP" : "Shared phone"}</span>
                  <span className="muted small">
                    {s.groups.map((g) => g.groupName).join(", ")} ({s.groups.length} groups)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {pending && pending.length > 0 && (
          <div className="panel">
            <h2 className="panel-title">Pending Payment Claims</h2>
            <div className="grid-wrap">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th className="al">Group</th>
                    <th className="al">Submitted by</th>
                    <th className="al">Network / Phone</th>
                    <th className="ar">Amount (K)</th>
                    <th className="al">Submitted</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((p) => (
                    <tr key={p.id}>
                      <td className="al">{p.groupName}</td>
                      <td className="al">{p.paidBy}</td>
                      <td className="al">{p.network} · {p.maskedPhone}</td>
                      <td className="ar">{p.amount.toLocaleString()}</td>
                      <td className="al muted tiny">{new Date(p.paidAt).toLocaleString()}</td>
                      <td className="cell-action">
                        <button className="btn-link" disabled={busyId === p.id} onClick={() => doConfirm(p.id)}>
                          confirm
                        </button>
                        <button className="btn-link" disabled={busyId === p.id} onClick={() => doReject(p.id)}>
                          reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {groups && (
          <div className="panel">
            <h2 className="panel-title">Groups</h2>
            <div className="grid-wrap">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th className="al">Name</th>
                    <th className="al">Code</th>
                    <th className="al">Tier</th>
                    <th className="ar">Members</th>
                    <th className="al">Created</th>
                    <th className="al">Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.id}>
                      <td className="al">{g.groupName}</td>
                      <td className="al muted">{g.slug}</td>
                      <td className="al">
                        <span className={g.tier === "premium" ? "status-paid" : "muted small"}>{g.tier}</span>
                      </td>
                      <td className="ar">{g.memberCount}</td>
                      <td className="al muted tiny">{new Date(g.createdAt).toLocaleDateString()}</td>
                      <td className="al">
                        {g.suspendedAt ? (
                          <span className="status-outstanding" title={g.suspendedReason}>suspended</span>
                        ) : (
                          <span className="status-paid">active</span>
                        )}
                      </td>
                      <td className="cell-action">
                        {g.suspendedAt ? (
                          <button className="btn-link" disabled={busyId === g.id} onClick={() => doUnsuspend(g)}>
                            unsuspend
                          </button>
                        ) : (
                          <button className="btn-link" disabled={busyId === g.id} onClick={() => doSuspend(g)}>
                            suspend
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {groups.length === 0 && (
                    <tr><td colSpan={7} className="muted small">No groups yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {groups && groups.length > 0 && <OwnerMessaging groups={groups} />}
      </main>
    </div>
  );
}
