import React, { useEffect, useState } from "react";
import {
  getReminderPrefs, saveReminderPrefs, registerPushSubscription, unregisterPushSubscription,
  getReminderDateOverrides, setReminderDateOverride,
} from "../lib/api.js";
import { pushSupported, subscribeToPush, unsubscribeFromPush, getExistingSubscription } from "../lib/push.js";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

export default function Reminders({ config }) {
  const [prefs, setPrefs] = useState({ pushEnabled: false, smsEnabled: false, phone: "", leadDays: 2 });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [overrides, setOverrides] = useState(null);

  useEffect(() => {
    (async () => {
      const p = await getReminderPrefs();
      setPrefs(p);
      const { overrides: o } = await getReminderDateOverrides();
      setOverrides(o);
    })();
  }, []);

  const togglePush = async (checked) => {
    setError("");
    setBusy(true);
    try {
      if (checked) {
        if (!VAPID_PUBLIC_KEY) throw new Error("Push isn't configured yet on this deployment.");
        const sub = await subscribeToPush(VAPID_PUBLIC_KEY);
        await registerPushSubscription(sub);
      } else {
        const sub = await getExistingSubscription();
        if (sub) {
          await unregisterPushSubscription(sub);
          await unsubscribeFromPush();
        }
      }
      const next = { ...prefs, pushEnabled: checked };
      setPrefs(next);
      await saveReminderPrefs(next);
      setStatus("Saved");
    } catch (e) {
      setError(e.message || "Could not update push settings.");
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(""), 1500);
    }
  };

  const updateField = (field, value) => {
    setPrefs({ ...prefs, [field]: value });
  };

  const save = async () => {
    setError("");
    if (prefs.smsEnabled && !prefs.phone?.trim()) {
      setError("Enter a phone number to receive SMS reminders.");
      return;
    }
    setBusy(true);
    try {
      await saveReminderPrefs(prefs);
      setStatus("Saved");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(""), 1500);
    }
  };

  return (
    <div className="panel">
      <h2 className="panel-title">Payment Reminders</h2>
      <p className="muted small">
        This Chilimba runs on a set schedule — get a nudge a few days before each due date so nothing gets missed.
      </p>

      <div className="field checkbox-field" style={{ marginTop: 14 }}>
        <input
          type="checkbox"
          checked={prefs.pushEnabled}
          disabled={busy || !pushSupported()}
          onChange={(e) => togglePush(e.target.checked)}
        />
        Push notifications on this device
        {!pushSupported() && <span className="muted tiny"> (not supported on this browser)</span>}
      </div>

      <div className="field checkbox-field">
        <input
          type="checkbox"
          checked={prefs.smsEnabled}
          onChange={(e) => updateField("smsEnabled", e.target.checked)}
        />
        SMS reminders
      </div>

      {prefs.smsEnabled && (
        <label className="field">
          Phone number for SMS
          <input
            type="tel"
            value={prefs.phone || ""}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="e.g. 097 XXX XXXX"
          />
        </label>
      )}

      <label className="field">
        Remind me this many days before each due date
        <input
          type="number"
          min="1"
          max="7"
          value={prefs.leadDays}
          onChange={(e) => updateField("leadDays", Number(e.target.value) || 2)}
          style={{ width: 80 }}
        />
      </label>

      {error && <div className="error-text">{error}</div>}

      <div className="field-row" style={{ marginTop: 10 }}>
        <button className="btn-primary" style={{ width: "auto" }} disabled={busy} onClick={save}>
          Save reminder settings
        </button>
        <span className="muted small">{status}</span>
      </div>

      <p className="muted tiny" style={{ marginTop: 12 }}>
        Your phone number is only used to send these reminders and is stored separately from
        your payment records.
      </p>

      {config?.schedule?.length > 0 && (
        <>
          <h3 className="panel-subtitle" style={{ marginTop: 24 }}>Per-Date Reminders</h3>
          <p className="muted tiny" style={{ marginBottom: 10 }}>
            Override your default above for a specific date — a different lead time, or no
            reminder for that date at all (handy for your own payout date, if you don't need
            a nudge about it).
          </p>
          {overrides === null ? (
            <p className="muted small">Loading…</p>
          ) : (
            <div className="grid-wrap">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th className="al">Date</th>
                    <th className="al">Group</th>
                    <th className="al">Reminder</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingRows(config.schedule).map((row) => (
                    <DateOverrideRow
                      key={row.id}
                      row={row}
                      override={overrides[row.id]}
                      defaultLeadDays={prefs.leadDays}
                      onChange={(next) => setOverrides({ ...overrides, [row.id]: next })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function upcomingRows(schedule) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return schedule
    .filter((r) => {
      const d = new Date(r.date);
      return !isNaN(d.getTime()) && d >= today;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function DateOverrideRow({ row, override, defaultLeadDays, onChange }) {
  const mode = override?.muted ? "muted" : override?.leadDays != null ? "custom" : "default";
  const [customDays, setCustomDays] = useState(override?.leadDays ?? defaultLeadDays);
  const [saving, setSaving] = useState(false);

  const applyMode = async (nextMode) => {
    setSaving(true);
    try {
      if (nextMode === "default") {
        await setReminderDateOverride(row.id, { leadDays: null, muted: false });
        onChange(undefined);
      } else if (nextMode === "muted") {
        await setReminderDateOverride(row.id, { leadDays: null, muted: true });
        onChange({ leadDays: null, muted: true });
      } else {
        await setReminderDateOverride(row.id, { leadDays: customDays, muted: false });
        onChange({ leadDays: customDays, muted: false });
      }
    } finally {
      setSaving(false);
    }
  };

  const saveCustomDays = async () => {
    setSaving(true);
    try {
      await setReminderDateOverride(row.id, { leadDays: Number(customDays) || defaultLeadDays, muted: false });
      onChange({ leadDays: Number(customDays) || defaultLeadDays, muted: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td className="al">{row.date}</td>
      <td className="al">{row.group}</td>
      <td className="al">
        <select value={mode} disabled={saving} onChange={(e) => applyMode(e.target.value)} style={{ marginRight: 8 }}>
          <option value="default">Default ({defaultLeadDays} days)</option>
          <option value="custom">Custom</option>
          <option value="muted">Don't remind me</option>
        </select>
        {mode === "custom" && (
          <>
            <input
              type="number"
              min="0"
              max="30"
              className="cell-input"
              style={{ width: 60 }}
              value={customDays}
              disabled={saving}
              onChange={(e) => setCustomDays(e.target.value)}
              onBlur={saveCustomDays}
            />
            <span className="muted tiny"> days before</span>
          </>
        )}
      </td>
    </tr>
  );
}
