import React, { useState } from "react";
import { postNotice, getGroupMembers } from "../lib/api.js";
import { useApiData } from "../lib/useApiData.js";

/**
 * Admin-only notice authoring tool — lives on the Community tab, not
 * the dashboard (see NoticeBoard.jsx, the read-only list every member
 * sees on their dashboard). This is an admin action, not member-facing
 * dashboard content, so it doesn't compete with the at-a-glance cards
 * there.
 */
export default function NoticeComposer() {
  const { data: membersData } = useApiData(getGroupMembers, []);
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState(""); // "" = everyone, else a member name
  const [busy, setBusy] = useState(false);
  const [postError, setPostError] = useState("");
  const [posted, setPosted] = useState(false);

  const handlePost = async () => {
    setPostError("");
    setPosted(false);
    if (!message.trim()) return;
    setBusy(true);
    try {
      await postNotice(message.trim(), target || undefined);
      setMessage("");
      setTarget("");
      setPosted(true);
    } catch (e) {
      setPostError(e.message || "Could not post the notice.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="notice-board">
      <h3 className="panel-subtitle">Post a Notice</h3>
      <p className="muted tiny" style={{ marginBottom: 10 }}>
        Shows up on every member's dashboard, or send it to just one person.
      </p>
      <div className="notice-post-form">
        {membersData?.members?.length > 0 && (
          <select
            className="notice-target-select"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={busy}
            aria-label="Post to"
          >
            <option value="">Post to: Everyone</option>
            {membersData.members.map((m) => (
              <option key={m.name} value={m.name}>Post to: {m.name}</option>
            ))}
          </select>
        )}
        <input
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setPosted(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && handlePost()}
          placeholder={target ? `Message for ${target}…` : "Post a notice to everyone in the group…"}
          maxLength={500}
          disabled={busy}
        />
        <button className="btn-ghost-dark" disabled={busy || !message.trim()} onClick={handlePost}>
          Post
        </button>
      </div>
      {postError && <div className="error-text" role="alert">{postError}</div>}
      {posted && <p className="muted tiny" style={{ marginTop: 6 }}>✓ Notice posted</p>}
    </div>
  );
}
