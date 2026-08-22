import React, { useEffect, useRef, useState } from "react";

/**
 * The header's current-group indicator doubles as a switcher once a
 * member belongs to more than one group on this device (see
 * useSession.js's myGroups/switchGroup, lib/myGroups.js). Always shown
 * once signed in — even with just one remembered group — so "+ Join
 * another group" stays discoverable rather than only appearing once
 * someone already has two.
 */
export default function GroupSwitcher({ session, config, myGroups, onSwitch, onRemove, onAddGroup }) {
  const [open, setOpen] = useState(false);
  const [busySlug, setBusySlug] = useState(null);
  const [error, setError] = useState("");
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

  const handleSwitch = async (groupSlug) => {
    if (groupSlug === session.groupSlug) {
      setOpen(false);
      return;
    }
    setError("");
    setBusySlug(groupSlug);
    try {
      await onSwitch(groupSlug);
      setOpen(false);
    } catch (e) {
      setError(e.message || "Could not switch to that group.");
    } finally {
      setBusySlug(null);
    }
  };

  const handleRemove = (e, groupSlug) => {
    e.stopPropagation();
    if (!window.confirm("Remove this group from your list on this device? You can add it back any time by signing in again.")) return;
    onRemove(groupSlug);
  };

  const label = config.cycleName ? `${session.groupName} · ${config.cycleName}` : session.groupName;

  return (
    <div className="group-switcher" ref={wrapRef}>
      <button
        className="group-switcher-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label} <span aria-hidden="true" className="group-switcher-caret">▾</span>
      </button>
      {open && (
        <div className="group-switcher-panel" role="menu">
          <div className="group-switcher-heading">My Groups</div>
          {myGroups.map((g) => (
            <div key={g.groupSlug} className="group-switcher-row">
              <button
                className={"group-switcher-item" + (g.groupSlug === session.groupSlug ? " group-switcher-item-active" : "")}
                role="menuitem"
                onClick={() => handleSwitch(g.groupSlug)}
              >
                <span className="group-switcher-item-info">
                  <span className="group-switcher-item-name">{g.groupName}</span>
                  <span className="muted tiny">
                    {g.name}
                    {g.role === "admin" && <span className="tag tag-rate" style={{ marginLeft: 6 }}>admin</span>}
                    {g.groupSlug === session.groupSlug && <span className="muted tiny"> · current</span>}
                  </span>
                </span>
              </button>
              {busySlug === g.groupSlug ? (
                <span className="muted tiny">Switching…</span>
              ) : (
                g.groupSlug !== session.groupSlug && (
                  <button
                    className="group-switcher-remove"
                    onClick={(e) => handleRemove(e, g.groupSlug)}
                    aria-label={`Remove ${g.groupName} from this device`}
                    title="Remove from this device"
                  >
                    ✕
                  </button>
                )
              )}
            </div>
          ))}
          {error && <div className="error-text tiny" role="alert" style={{ padding: "4px 12px" }}>{error}</div>}
          <div className="nav-menu-divider" />
          <button
            className="group-switcher-item group-switcher-add"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onAddGroup();
            }}
          >
            + Join another group
          </button>
        </div>
      )}
    </div>
  );
}
