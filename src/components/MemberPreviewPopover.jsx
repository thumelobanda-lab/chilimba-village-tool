import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Avatar from "./Avatar.jsx";
import { computeTooltipPosition } from "../lib/spotlightPosition.js";

// Used before the panel has actually rendered once (so its real
// offsetWidth/offsetHeight are known) — close enough to .profile-preview-
// panel's real size (min-width 180px, ~150-200px tall) that the very
// first frame still lands in a sane spot instead of at 0,0.
const PANEL_SIZE_ESTIMATE = { width: 200, height: 180 };

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
 * The panel is `position: fixed`, placed via computeTooltipPosition (the
 * same geometry SpotlightTour.jsx already uses) rather than sitting
 * `position: absolute` under the trigger — PayoutAvatarRow's avatar strip
 * scrolls horizontally (`overflow-x: auto`), which per the CSS spec forces
 * overflow-y to clip too, so an absolutely-positioned panel taller than
 * the strip itself used to get cut off the moment it opened. Fixed
 * positioning isn't subject to an ancestor's overflow at all, so this
 * works the same whether the trigger is the header's own badge or one
 * avatar buried in a scrolling row — and computeTooltipPosition already
 * clamps to the viewport and flips above the trigger when there's no
 * room below, so a panel opened from an edge avatar doesn't run off
 * screen either.
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
  // Trigger's own getBoundingClientRect(), re-measured on open and kept
  // fresh while open (below) — computeTooltipPosition needs to know where
  // the trigger is, not the panel, to decide where to place the panel.
  const [triggerRect, setTriggerRect] = useState(null);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const hasRealPhoto = hasPhoto || !!photoDataUrl;

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setTriggerRect(null);
      return undefined;
    }
    setTriggerRect(triggerRef.current.getBoundingClientRect());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keeps the panel aligned with its trigger as the page scrolls, resizes,
  // or the device rotates underneath it — same wiring SpotlightTour.jsx
  // already uses, and for the same reason PayoutAvatarRow needs it here:
  // its avatar strip scrolls horizontally on its own, separately from the
  // page, so this has to listen in the capture phase (`true`) to notice
  // that inner scroll too, not just window-level scrolling.
  useEffect(() => {
    if (!open) return undefined;
    const reposition = () => {
      if (triggerRef.current) setTriggerRect(triggerRef.current.getBoundingClientRect());
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("orientationchange", reposition);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("orientationchange", reposition);
    };
  }, [open]);

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

  // panelRef.current is only ever populated from a PRIOR render's commit
  // (the panel doesn't exist in the DOM yet on the render that first
  // creates it) — same estimate-then-self-correct approach as
  // SpotlightTour.jsx's own tooltipSize, so the very first paint uses
  // PANEL_SIZE_ESTIMATE and any render after that uses the real size.
  const panelPos = triggerRect
    ? computeTooltipPosition(
        triggerRect,
        { width: window.innerWidth, height: window.innerHeight },
        panelRef.current
          ? { width: panelRef.current.offsetWidth, height: panelRef.current.offsetHeight }
          : PANEL_SIZE_ESTIMATE
      )
    : null;

  return (
    <div className="profile-preview" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
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
      {open && triggerRect && (
        <div
          ref={panelRef}
          className="profile-preview-panel"
          role="menu"
          style={{ top: panelPos.top, left: panelPos.left }}
        >
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
