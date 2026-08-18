import React, { useState } from "react";
import { getNotices, postNotice, deleteNotice } from "../lib/api.js";
import { useApiData } from "../lib/useApiData.js";

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NoticeBoard({ isAdmin }) {
  const { data, error, loading, refresh } = useApiData(getNotices, []);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [postError, setPostError] = useState("");
  const [expanded, setExpanded] = useState(false);

  const handlePost = async () => {
    setPostError("");
    if (!message.trim()) return;
    setBusy(true);
    try {
      await postNotice(message.trim());
      setMessage("");
      await refresh();
    } catch (e) {
      setPostError(e.message || "Could not post the notice.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this notice?")) return;
    await deleteNotice(id);
    await refresh();
  };

  if (loading && !data) return null; // don't flash an empty board while first loading
  if (error) return null; // notices are non-critical — fail quietly, don't block the dashboard

  const notices = data?.notices || [];
  const visible = expanded ? notices : notices.slice(0, 1);

  return (
    <div className="notice-board">
      {notices.length === 0 && !isAdmin ? null : (
        <>
          {visible.map((n) => (
            <div className="notice-item" key={n.id}>
              <div className="notice-message">📢 {n.message}</div>
              <div className="notice-meta">
                <span className="muted tiny">{n.postedBy} · {timeAgo(n.postedAt)}</span>
                {isAdmin && (
                  <button className="btn-link" onClick={() => handleDelete(n.id)}>remove</button>
                )}
              </div>
            </div>
          ))}
          {notices.length > 1 && (
            <button className="btn-link" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Show less" : `Show ${notices.length - 1} more notice${notices.length - 1 > 1 ? "s" : ""}`}
            </button>
          )}
        </>
      )}

      {isAdmin && (
        <div className="notice-post-form">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePost()}
            placeholder="Post a notice to everyone in the group…"
            maxLength={500}
            disabled={busy}
          />
          <button className="btn-ghost-dark" disabled={busy || !message.trim()} onClick={handlePost}>
            Post
          </button>
        </div>
      )}
      {postError && <div className="error-text" role="alert">{postError}</div>}
    </div>
  );
}
