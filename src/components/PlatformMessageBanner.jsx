import React, { useEffect, useState } from "react";
import { getMyMessages, markMessageRead } from "../lib/api.js";

/**
 * The signed-in member/admin's own inbox for a platform-owner direct
 * message (see worker/src/routes/messages.js) — deliberately styled and
 * worded distinctly from NoticeBoard.jsx's "📢 posted by <admin>" feed,
 * so there's no way to mistake a platform-level message for something
 * their own group's admin said. One-shot: dismissing marks it read
 * server-side, so — unlike NoticeBoard, which keeps showing history —
 * it never comes back once seen.
 */
export default function PlatformMessageBanner() {
  const [messages, setMessages] = useState([]);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getMyMessages()
      .then((data) => { if (!cancelled) setMessages(data.messages || []); })
      .catch(() => {}); // non-critical — never blocks the rest of the dashboard
    return () => { cancelled = true; };
  }, []);

  const dismiss = async (recipientId) => {
    setBusyId(recipientId);
    try {
      await markMessageRead(recipientId);
      setMessages((prev) => prev.filter((m) => m.recipientId !== recipientId));
    } finally {
      setBusyId(null);
    }
  };

  if (messages.length === 0) return null;

  return (
    <div className="platform-message-stack">
      {messages.map((m) => (
        <div className="platform-message-banner" role="status" key={m.recipientId}>
          <div className="platform-message-badge">✦ Message from Chilimba Circle</div>
          <div className="platform-message-body">{m.message}</div>
          <div className="platform-message-footer">
            <span className="muted tiny" style={{ color: "rgba(255,255,255,0.75)" }}>
              {new Date(m.sentAt).toLocaleString()}
            </span>
            <button
              className="platform-message-dismiss"
              disabled={busyId === m.recipientId}
              onClick={() => dismiss(m.recipientId)}
            >
              Got it
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
