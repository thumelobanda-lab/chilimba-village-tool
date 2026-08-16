import React, { useEffect, useState } from "react";
import { getReminderPrefs, saveReminderPrefs, registerPushSubscription, unregisterPushSubscription } from "../lib/api.js";
import { pushSupported, subscribeToPush, unsubscribeFromPush, getExistingSubscription } from "../lib/push.js";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

export default function Reminders() {
  const [prefs, setPrefs] = useState({ pushEnabled: false, smsEnabled: false, phone: "", leadDays: 2 });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await getReminderPrefs();
      setPrefs(p);
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
        This is a biweekly Chilimba — get a nudge a few days before each due date so nothing gets missed.
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
    </div>
  );
}
