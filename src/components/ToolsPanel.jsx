import React, { useEffect, useState } from "react";
import { getNotepad, saveNotepad } from "../lib/api.js";
import { useApiData } from "../lib/useApiData.js";
import QuickCalculator from "./QuickCalculator.jsx";
import Toast from "./Toast.jsx";
import Icon from "./Icon.jsx";

const MAX_LENGTH = 5000;

/**
 * Small personal utilities, grouped in one tab since none of them touch
 * group/payment data — a genuine arithmetic calculator (reused from the
 * header icon, not rebuilt), a private scratchpad, and a device-level
 * theme toggle (also reachable from the nav menu; this is just a second,
 * more discoverable entry point to the same useTheme() state lifted in
 * App.jsx).
 */
export default function ToolsPanel({ theme, onToggleTheme }) {
  const [showCalculator, setShowCalculator] = useState(false);
  const { data, error: loadError } = useApiData(getNotepad, []);
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  // Only overwrite the textarea from a fresh load, never from a refetch
  // mid-edit — there isn't one here (useApiData's deps never change),
  // but matching the pattern used elsewhere (e.g. GroupSetup's draft)
  // keeps a local edit from ever being clobbered if that changes later.
  useEffect(() => {
    if (data && !dirty) setText(data.text || "");
  }, [data, dirty]);

  const save = async () => {
    setError("");
    setBusy(true);
    try {
      await saveNotepad(text);
      setDirty(false);
      setStatus("Saved");
    } catch (e) {
      setError(e.message || "Could not save your notes.");
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(""), 1500);
    }
  };

  return (
    <div className="panel">
      <h2 className="panel-title">Tools</h2>
      <p className="muted small">
        A few small utilities — nothing here touches your group's payments or schedule.
      </p>

      <h3 className="panel-subtitle"><Icon name="calculator" size={16} className="icon-inline" /> Calculator</h3>
      <p className="muted tiny" style={{ marginBottom: 10 }}>
        A genuine arithmetic calculator — the same one behind the calculator icon at the top of the app.
      </p>
      <button className="btn-ghost-dark" onClick={() => setShowCalculator(true)}>
        Open Calculator
      </button>
      {showCalculator && <QuickCalculator onClose={() => setShowCalculator(false)} />}

      <h3 className="panel-subtitle" style={{ marginTop: 24 }}><Icon name="notebook" size={16} className="icon-inline" /> Notepad</h3>
      <p className="muted tiny" style={{ marginBottom: 10 }}>
        Private to you — nobody else in your group can see this, including admins.
      </p>
      {loadError && <div className="error-text" role="alert">{loadError}</div>}
      <textarea
        className="notepad-textarea"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        maxLength={MAX_LENGTH}
        placeholder="Jot down anything — a phone number, a reminder to yourself…"
        disabled={busy}
        rows={8}
      />
      <p className="muted tiny" style={{ marginTop: 4 }}>{text.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}</p>
      {error && <div className="error-text" role="alert">{error}</div>}
      <div className="field-row" style={{ marginTop: 10 }}>
        <button className="btn-primary" style={{ width: "auto" }} disabled={busy || !dirty} onClick={save}>
          {busy ? "Saving…" : "Save notes"}
        </button>
      </div>
      <Toast message={status} />

      <h3 className="panel-subtitle" style={{ marginTop: 24 }}>Appearance</h3>
      <div className="field checkbox-field" style={{ marginTop: 4 }}>
        <input type="checkbox" checked={theme === "dark"} onChange={onToggleTheme} />
        Dark mode
      </div>
    </div>
  );
}
