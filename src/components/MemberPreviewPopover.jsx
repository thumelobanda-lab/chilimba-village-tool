import React, { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar.jsx";

/**
 * Shared tap-to-preview popover — the trigger/panel/outside-click/Escape
 * plumbing behind both the header's own badge (ProfilePreview.jsx, always
 * the signed-in member) and PayoutAvatarRow's per-avatar preview (any
 * member in the rotation). Extracted here so both share one open/close
 * pattern instead of drifting into two — same lineage as GroupSwitcher.jsx/
 * NavMenu.jsx's identical pattern.
 *
 * `isSelf` gates the "Change photo" action — previewing a teammate's
 * avatar shows their photo and name only; only your own preview offers a
 * way to change it. `triggerClassName`/`badge` let a caller (PayoutAvatarRow)
 * layer its own status-ring classes and a small badge (e.g. the received
 * checkmark) onto the trigger without this component needing to know
 * anything about payout status. `triggerProps` passes through arbitrary
 * extra handlers (PayoutAvatarRow's long-press-to-remind uses this) —
 * merged onto the trigger button after the click handler this component
 * needs for itself.
 *
 * The panel itself only ever shows a modest (`panelAvatarSize`) preview —
 * tapping that photo a second time, when there is an actual photo (not
 * just an initials fallback), expands it into a full-screen view instead
 * of growing the panel itself, so the rest of the panel's controls (name,
 * "Change photo") stay reachable at their normal size.
 */
export default function MemberPreviewPopover({
  name,
  hasPhoto,
  photoDataUrl,
  isSelf,
  onChangePhoto,
  subtitle,
  triggerSize = 28,
  triggerBordered = true,
  panelAvatarSize = 64,
  triggerClassName = "",
  badge,
  triggerTitle,
  triggerProps = {},
}) {
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const wrapRef = useRef(null);
  const hasRealPhoto = hasPhoto || !!photoDataUrl;

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

  // A closed panel has no business remembering it was mid-zoom — reopening
  // should always start back at the normal panel size.
  useEffect(() => {
    if (!open) setFullscreen(false);
  }, [open]);

  useEffect(() => {
    if (!fullscreen) return;
    function handleKey(e) {
      if (e.key === "Escape") setFullscreen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [fullscreen]);

  const { onClick: extraOnClick, ...restTriggerProps } = triggerProps;

  return (
    <div className="profile-preview" ref={wrapRef}>
      <button
        type="button"
        className={("profile-preview-trigger " + triggerClassName).trim()}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`${name} — view profile`}
        title={triggerTitle || name}
        onClick={(e) => {
          // Let a caller's own click handler (PayoutAvatarRow's
          // long-press-suppression, e.g.) veto the open/close toggle by
          // calling preventDefault() — checked before touching state, not
          // after, since undoing an already-applied setOpen would flash
          // the panel open for a frame first.
          extraOnClick?.(e);
          if (e.defaultPrevented) return;
          setOpen((o) => !o);
        }}
        {...restTriggerProps}
      >
        <Avatar name={name} hasPhoto={hasPhoto} photoDataUrl={photoDataUrl} size={triggerSize} bordered={triggerBordered} />
        {badge}
      </button>
      {open && (
        <div className="profile-preview-panel" role="menu">
          {hasRealPhoto ? (
            <button
              type="button"
              className="profile-preview-photo-expand"
              onClick={() => setFullscreen(true)}
              aria-label={`View ${name}'s photo full-screen`}
              title="Tap to view full-screen"
            >
              <Avatar name={name} hasPhoto={hasPhoto} photoDataUrl={photoDataUrl} size={panelAvatarSize} />
            </button>
          ) : (
            <Avatar name={name} hasPhoto={hasPhoto} photoDataUrl={photoDataUrl} size={panelAvatarSize} />
          )}
          <div className="profile-preview-name">{name}</div>
          {subtitle && <div className="muted tiny">{subtitle}</div>}
          {isSelf && onChangePhoto && (
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
          )}
        </div>
      )}
      {fullscreen && (
        <div
          className="photo-lightbox-backdrop"
          onClick={() => setFullscreen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${name}'s photo`}
        >
          <button
            type="button"
            className="photo-lightbox-close"
            onClick={() => setFullscreen(false)}
            aria-label="Close"
          >
            ✕
          </button>
          <Avatar name={name} hasPhoto={hasPhoto} photoDataUrl={photoDataUrl} size="min(85vw, 85vh)" bordered={false} />
        </div>
      )}
    </div>
  );
}
