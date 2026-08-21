import React, { useEffect, useState, useCallback } from "react";
import {
  getOwnerGroupMembers, sendOwnerMessage, getOwnerMessages, getOwnerSettings, updateOwnerSettings,
} from "../../lib/api/owner.js";
import { buildWhatsAppDirectUrl } from "../../lib/inviteCard.js";
import {
  MESSAGE_CATEGORIES, getMessageCategory, applyTemplatePlaceholders, buildContactLabel,
} from "../../lib/messageTemplates.js";

const TARGET_LABELS = {
  user: "A specific person",
  group_admins: "All admins of this group",
  group_members: "All members of this group",
};

function todayLabel() {
  return new Date().toLocaleDateString("en-ZM", { day: "numeric", month: "short", year: "numeric" });
}

// The colored pill a category shows as in the sent-messages log — see
// .category-tag-* in styles.css for the actual colors, one per
// tagColor (fraud/warning/billing/suspended/general/review).
function CategoryTag({ categoryId }) {
  const category = getMessageCategory(categoryId);
  if (!category) return <span className="muted tiny">—</span>;
  return (
    <span className={`category-tag category-tag-${category.tagColor}`}>
      {category.icon} {category.label}
    </span>
  );
}

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
  const [category, setCategory] = useState("");
  const [alsoWhatsApp, setAlsoWhatsApp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastSend, setLastSend] = useState(null); // { targetLabel, messageText, category, recipients } | null
  const [log, setLog] = useState(null);

  // The platform-wide support contact behind every template's [Contact]
  // placeholder — set once here (GET/PUT /api/owner/settings), reused
  // by every send afterward. contactSaved is a brief "✓ Saved" beat on
  // the save button itself, same pattern LedgerTable.jsx uses for
  // "✓ Logged" after logging a payment.
  const [supportEmail, setSupportEmail] = useState("");
  const [supportWhatsapp, setSupportWhatsapp] = useState("");
  // PUT /api/owner/settings always writes both fields from whatever's in
  // local state (there's no partial-update semantics) — so saving before
  // the initial GET has resolved would silently overwrite whichever
  // field hadn't loaded yet with "". settingsLoaded gates both the
  // inputs and the Save button until the real current values are in
  // state, closing that window entirely rather than just narrowing it.
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);
  const contactLabel = buildContactLabel({ supportEmail, supportWhatsapp });

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
    getOwnerSettings()
      .then((data) => {
        setSupportEmail(data.supportEmail || "");
        setSupportWhatsapp(data.supportWhatsapp || "");
      })
      .catch((e) => setError(e.message || "Could not load the support contact."))
      .finally(() => setSettingsLoaded(true));
  }, [loadLog]);

  const handleSaveContact = async () => {
    setError("");
    setContactBusy(true);
    try {
      await updateOwnerSettings({ supportEmail: supportEmail.trim(), supportWhatsapp: supportWhatsapp.trim() });
      setContactSaved(true);
      setTimeout(() => setContactSaved(false), 1500);
    } catch (e) {
      setError(e.message || "Could not save the support contact.");
    } finally {
      setContactBusy(false);
    }
  };

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

  // Selecting a category always drives the log's color tag; it only
  // touches the message text itself when there's nothing typed yet, so
  // picking a category never silently destroys something the owner
  // already wrote. insertTemplate (below) is the explicit, confirmed
  // way to load/reload the template's wording after that.
  const handleCategoryChange = (newCategoryId) => {
    setCategory(newCategoryId);
    if (!newCategoryId || message.trim()) return;
    const cat = getMessageCategory(newCategoryId);
    if (cat) setMessage(applyTemplatePlaceholders(cat.template, { groupName, dateLabel: todayLabel(), contactLabel }));
  };

  const insertTemplate = () => {
    const cat = getMessageCategory(category);
    if (!cat) return;
    if (message.trim() && !window.confirm("Replace the current message text with this template's wording?")) return;
    setMessage(applyTemplatePlaceholders(cat.template, { groupName, dateLabel: todayLabel(), contactLabel }));
  };

  const handleSend = async () => {
    setError("");
    setLastSend(null);
    if (!canSend) return;
    setBusy(true);
    const sentText = message.trim();
    try {
      const result = await sendOwnerMessage({
        groupId, targetType, userId: targetType === "user" ? userId : undefined,
        message: sentText, alsoWhatsApp, category: category || undefined,
      });
      setLastSend({
        targetLabel:
          targetType === "user"
            ? `${members.find((m) => m.id === userId)?.displayName || "that person"} (${groupName})`
            : `${TARGET_LABELS[targetType]} — ${groupName}`,
        messageText: sentText,
        category,
        recipients: alsoWhatsApp ? result.recipients : [],
      });
      setMessage("");
      setCategory("");
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

      <div className="setup-section-body" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "12px 14px", marginBottom: 18 }}>
        <div className="panel-subtitle" style={{ margin: "0 0 8px" }}>Support contact</div>
        <p className="muted tiny" style={{ marginBottom: 10 }}>
          Fills the [Contact] placeholder in every template below — set it once, every category's
          resolve/appeal line uses it from then on.
        </p>
        <div className="field-row">
          <label className="field" style={{ flex: 1, minWidth: 200 }}>
            Support email
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder={settingsLoaded ? "support@chilimbacircle.app" : "Loading…"}
              disabled={!settingsLoaded}
            />
          </label>
          <label className="field" style={{ flex: 1, minWidth: 200 }}>
            Support WhatsApp number
            <input
              type="tel"
              value={supportWhatsapp}
              onChange={(e) => setSupportWhatsapp(e.target.value)}
              placeholder={settingsLoaded ? "+260 97 123 4567" : "Loading…"}
              disabled={!settingsLoaded}
            />
          </label>
        </div>
        <button className="btn-ghost-dark" disabled={contactBusy || !settingsLoaded} onClick={handleSaveContact}>
          {!settingsLoaded ? "Loading…" : contactBusy ? "Saving…" : contactSaved ? "✓ Saved" : "Save support contact"}
        </button>
      </div>

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
        Template category
        <select value={category} onChange={(e) => handleCategoryChange(e.target.value)}>
          <option value="">No template — write freely</option>
          {MESSAGE_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
          ))}
        </select>
      </label>

      {category && (
        <p className="muted tiny" style={{ marginTop: -8, marginBottom: 14 }}>
          <button type="button" className="btn-link" onClick={insertTemplate}>
            ↻ Load this template's wording into the message below
          </button>
          {" — "}edit freely before sending; only [Group Name], [Date], and [Contact] are filled in for you.
        </p>
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
          {lastSend.category && (
            <div style={{ marginTop: 6 }}><CategoryTag categoryId={lastSend.category} /></div>
          )}
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
                <th className="al">Category</th>
                <th className="al">Recipient</th>
                <th className="al">Message</th>
                <th className="ar">Reached</th>
                <th className="al">Sent</th>
              </tr>
            </thead>
            <tbody>
              {log.map((m) => (
                <tr key={m.id}>
                  <td className="al"><CategoryTag categoryId={m.category} /></td>
                  <td className="al">{m.targetLabel}</td>
                  <td className="al" style={{ whiteSpace: "pre-wrap" }}>{m.message}</td>
                  <td className="ar">{m.recipientCount}</td>
                  <td className="al muted tiny">{new Date(m.sentAt).toLocaleString()}</td>
                </tr>
              ))}
              {log.length === 0 && (
                <tr><td colSpan={5} className="muted small">No messages sent yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
