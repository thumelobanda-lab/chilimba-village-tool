import React, { useState } from "react";
import { getNotices, deleteNotice } from "../lib/api.js";
import { useApiData } from "../lib/useApiData.js";
import Icon from "./Icon.jsx";

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Read-only notice list — the dashboard's "Notices / alerts" focal
 * point. Posting lives separately in NoticeComposer.jsx (Community
 * tab), since authoring a notice is an admin tool, not something every
 * member looks at; this component only renders what's actually
 * dashboard content; an admin can still remove a notice from here.
 */
export default function NoticeBoard({ isAdmin }) {
  const { data, error, loading, refresh } = useApiData(getNotices, []);
  const [expanded, setExpanded] = useState(false);

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this notice?")) return;
    await deleteNotice(id);
    await refresh();
  };

  if (loading && !data) return null; // don't flash an empty board while first loading
  if (error) return null; // notices are non-critical — fail quietly, don't block the dashboard

  const notices = data?.notices || [];
  if (notices.length === 0) return null;
  const visible = expanded ? notices : notices.slice(0, 1);

  return (
    <div className="notice-board">
      {visible.map((n) => (
        <div className="notice-item" key={n.id}>
          <div className="notice-message">
            <Icon name={n.targetMemberName ? "mail" : "megaphone"} size={14} className="icon-inline" /> {n.message}
          </div>
          <div className="notice-meta">
            <span className="muted tiny">{n.postedBy} · {timeAgo(n.postedAt)}</span>
            {n.targetMemberName && <span className="tag notice-target-tag">→ {n.targetMemberName}</span>}
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
    </div>
  );
}
