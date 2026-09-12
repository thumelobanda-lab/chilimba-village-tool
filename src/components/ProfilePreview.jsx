import React, { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar.jsx";

/**
 * The header's own small profile badge (top-left, under the OpenBook
 * wordmark) — tapping it opens a quick preview (larger photo, name, a
 * "Change photo" shortcut) rather than jumping straight to My Account
 * the way the old header avatar button did. Same open/click-outside/
 * Escape pattern as GroupSwitcher.jsx and NavMenu.jsx, so every header
 * dropdown in this app behaves identically.
 *
 * Doesn't fetch its own photo — App.jsx already fetches the signed-in
 * member's own photo once (headerPhotoUrl) for this exact purpose;
 * passed in here and reused at two sizes rather than fetched twice.
 * Falls back to Avatar.jsx's own initials-on-a-colored-circle rendering
 * whenever there's no photo, same as everywhere else in the app that
 * shows a member's avatar — never a blank icon.
 */
export default function ProfilePreview({ session, photoUrl, onChangePhoto }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function handleKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="profile-preview" ref={wrapRef}>
      <button
        type="button"
        className="profile-preview-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`${session.name} — view profile`}
        title={session.name}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar name={session.name} photoDataUrl={photoUrl} size={28} />
      </button>
      {open && (
        <div className="profile-preview-panel" role="menu">
          <Avatar name={session.name} photoDataUrl={photoUrl} size={64} />
          <div className="profile-preview-name">{session.name}</div>
          <button
            type="button"
            className="btn-ghost-dark"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onChangePhoto();
            }}
          >
            Change photo
          </button>
        </div>
      )}
    </div>
  );
}
