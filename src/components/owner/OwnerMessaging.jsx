import React, { useEffect, useState, useCallback } from "react";
import { getOwnerGroupMembers, sendOwnerMessage, getOwnerMessages } from "../../lib/api/owner.js";
import { buildWhatsAppDirectUrl } from "../../lib/inviteCard.js";

const TARGET_LABELS = {
  user: "A specific person",
  group_admins: "All admins of this group",
  group_members: "All members of this group",
};

/**
 * The owner's one-way messaging panel — compose (to one person, a
 * group's admins, or a group's members) plus a log of everything sent.
 * Reuses the app's existing WhatsApp-ready pattern (buildWhatsAppShareUrl,
 * lib/inviteCard.js — the same wa.me link InviteCard/Receipt already
 * open): there's no server-side WhatsApp send anywhere in this codebase,
 * so "also push via WhatsApp" surfaces one tap-to-open link per resolved
 * recipient with a phone on file, right after sending, rather than
 * claiming an automated bulk send that doesn't exist.
 *
 * Every request here goes through lib/api/owner.js's ownerFetch, which
 * only ever attaches the owner session token (chilimba:owner-session) —
 * see that file's header comment. A group admin's own session simply
 * isn't a credential this screen or the routes behind it know how to
 * check, so there's no path from "signed in as a group admin" to
 * anything on this panel.
 */
export default function OwnerMessaging({ groups }) {
  const [groupId, setGroupId] = useState("");
  const [targetType, setTargetType] = useState("group_members");
  const [members, setMembers] = useState([]);
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("");
  const [alsoWhatsApp, setAlsoWhatsApp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastSend, setLastSend] = useState(null); // { targetLabel, messageText, recipients } | null
  const [log, setLog] = useState(null);

  const loadLog = useCallback(async () => {
    try {
      const data = await getOwnerMessages();
      setLog(data.messages);
    } catch (e) {
      setError(e.message || "Could not load the message log.");
    }
  }, []);

  useEffect(() => {
    loadLog();
  }, [loadLog]);

  useEffect(() => {
    setUserId("");
    setMembers([]);
    if (!groupId || targetType !== "user") return;
    getOwnerGroupMembers(groupId)
      .then((data) => setMembers(data.members))
      .catch((e) => setError(e.message || "Could not load that group's members."));
  }, [groupId, targetType]);

  const groupName = groups.find((g) => g.id === groupId)?.groupName || "";
  const canSend =
    groupId && message.trim() && (targetType !== "user" || userId) && !busy;

  const handleSend = async () => {
    setError("");
    setLastSend(null);
    if (!canSend) return;
    setBusy(true);
    const sentText = message.trim();
    try {
      const result = await sendOwnerMessage({
        groupId, targetType, userId: targetType === "user" ? userId : undefined,
        message: sentText, alsoWhatsApp,
      });
      setLastSend({
        targetLabel:
          targetType === "user"
            ? `${members.find((m) => m.id === userId)?.displayName || "that person"} (${groupName})`
            : `${TARGET_LABELS[targetType]} — ${groupName}`,
        messageText: sentText,
        recipients: alsoWhatsApp ? result.recipients : [],
      });
      setMessage("");
      await loadLog();
    } catch (e) {
      setError(e.message || "Could not send that message.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2 className="panel-title">Send a Message</h2>
      <p className="muted small" style={{ marginBottom: 14 }}>
        A one-way message to a specific person, a group's admins, or a group's members —
        not a chat, there's no reply channel. It shows up in-app for whoever it's addressed
        to the next time they open Chilimba Circle.
      </p>

      <label className="field">
        Group
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">Select a group…</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.groupName} ({g.slug})</option>
          ))}
        </select>
      </label>

      <label className="field">
        Send to
        <select value={targetType} onChange={(e) => setTargetType(e.target.value)}>
          <option value="group_members">{TARGET_LABELS.group_members}</option>
          <option value="group_admins">{TARGET_LABELS.group_admins}</option>
          <option value="user">{TARGET_LABELS.user}</option>
        </select>
      </label>

      {targetType === "user" && (
        <label className="field">
          Person
          {groupId ? (
            members.length === 0 ? (
              <span className="muted small">Loading members…</span>
            ) : (
              <select value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Select a person…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName} {m.role === "admin" ? "· admin" : ""}
                  </option>
                ))}
              </select>
            )
          ) : (
            <span className="muted small">Select a group first.</span>
          )}
        </label>
      )}

      <label className="field">
        Message
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="What do you want them to know?"
          style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 4, font: "inherit", color: "var(--ink)", background: "var(--panel)" }}
        />
      </label>

      <label className="checkbox-field" style={{ marginBottom: 14 }}>
        <input type="checkbox" checked={alsoWhatsApp} onChange={(e) => setAlsoWhatsApp(e.target.checked)} />
        Also prepare WhatsApp share links for recipients with a phone number on file
      </label>

      {error && <div className="error-text" role="alert">{error}</div>}

      <button className="btn-primary" style={{ width: "auto" }} disabled={!canSend} onClick={handleSend}>
        {busy ? "Sending…" : "Send message"}
      </button>

      {lastSend && (
        <div className="card card-highlight" style={{ marginTop: 14 }}>
          <div className="card-label">Sent to {lastSend.targetLabel}</div>
          {lastSend.recipients.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="muted tiny" style={{ marginBottom: 6 }}>
                Open WhatsApp for a recipient (their number is on file — this only opens a
                pre-filled chat, nothing sends automatically):
              </div>
              {lastSend.recipients.filter((r) => r.phone).map((r) => (
                <a
                  key={r.id}
                  className="btn-ghost-dark"
                  style={{ display: "inline-block", marginRight: 8, marginBottom: 8 }}
                  href={buildWhatsAppDirectUrl(r.phone, lastSend.messageText)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  💬 {r.name}
                </a>
              ))}
              {lastSend.recipients.every((r) => !r.phone) && (
                <span className="muted small">None of the recipients have a phone number on file.</span>
              )}
            </div>
          )}
        </div>
      )}

      {log && (
        <div className="grid-wrap" style={{ marginTop: 20 }}>
          <h3 className="panel-subtitle">Messages Sent</h3>
          <table className="grid-table">
            <thead>
              <tr>
                <th className="al">Recipient</th>
                <th className="al">Message</th>
                <th className="ar">Reached</th>
                <th className="al">Sent</th>
              </tr>
            </thead>
            <tbody>
              {log.map((m) => (
                <tr key={m.id}>
                  <td className="al">{m.targetLabel}</td>
                  <td className="al">{m.message}</td>
                  <td className="ar">{m.recipientCount}</td>
                  <td className="al muted tiny">{new Date(m.sentAt).toLocaleString()}</td>
                </tr>
              ))}
              {log.length === 0 && (
                <tr><td colSpan={4} className="muted small">No messages sent yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
