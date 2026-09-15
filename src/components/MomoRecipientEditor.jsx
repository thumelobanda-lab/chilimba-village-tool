import React, { useEffect, useState } from "react";
import { getMyMomoInfo, updateMyMomoInfo, MOMO_PROVIDERS } from "../lib/api.js";
import { maskPhone } from "../lib/crypto.js";

/**
 * Self-service editor for where THIS member's own payout should be
 * sent — provider + number, separate from their login phone since the
 * two can legitimately differ. Lives in Profile.jsx ("My Account") so
 * a member can come back and change it any time, not just at signup.
 *
 * Saving is gated behind an explicit confirm step ("Payouts will go to
 * [masked number] on [provider] — confirm") rather than saving on
 * blur/submit directly — getting a payout recipient wrong is the kind
 * of mistake you want a member to actively notice, not something that
 * silently sticks from a typo. The masked-number confirmation text
 * matches how the number reads everywhere else in the app (nobody but
 * the owner ever sees it in full) even though this screen belongs to
 * the owner — the point is "does this look right at a glance", not
 * re-displaying the number they just typed.
 *
 * Data field and UI only (per docs/momo-integration-scope.md) — this
 * never triggers a real charge or payout, just saves where one would
 * go once that integration exists.
 */
export default function MomoRecipientEditor() {
  const [savedProvider, setSavedProvider] = useState(null);
  const [savedPhone, setSavedPhone] = useState(null);
  const [provider, setProvider] = useState(MOMO_PROVIDERS[0]);
  const [phone, setPhone] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getMyMomoInfo()
      .then((info) => {
        if (cancelled) return;
        setSavedProvider(info.provider);
        setSavedPhone(info.phone);
        if (info.provider) setProvider(info.provider);
        if (info.phone) setPhone(info.phone);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const startConfirm = () => {
    setError("");
    if (!phone.trim()) {
      setError("Enter the mobile money number your payout should go to.");
      return;
    }
    setConfirming(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      await updateMyMomoInfo({ provider, phone: phone.trim() });
      setSavedProvider(provider);
      setSavedPhone(phone.trim());
      setConfirming(false);
      setStatus("Saved");
    } catch (e) {
      setError(e.message || "Could not save your payout number.");
      setConfirming(false);
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(""), 1500);
    }
  };

  if (loading) return null;

  return (
    <>
      <h3 className="panel-subtitle">Mobile Money Payout Number</h3>
      <p className="muted tiny" style={{ marginBottom: 10 }}>
        Where your own payout gets sent when it's your turn — this can be different from the
        number you log in with. You can change it here any time.
      </p>

      {savedProvider && savedPhone && !confirming && (
        <p className="muted small" style={{ marginBottom: 10 }}>
          Currently set: <strong>{savedProvider}</strong>, {savedPhone}
        </p>
      )}

      {confirming ? (
        <div className="panel" style={{ background: "var(--panel-2, #f6f3ea)", marginBottom: 12 }}>
          <p>
            Payouts will go to <strong>{maskPhone(phone)}</strong> on <strong>{provider}</strong> —
            confirm?
          </p>
          <div className="field-row">
            <button className="btn-primary" style={{ width: "auto" }} disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Confirm"}
            </button>
            <button className="btn-ghost-dark" style={{ width: "auto" }} disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <label className="field">
            Network
            <select value={provider} onChange={(e) => setProvider(e.target.value)}>
              {MOMO_PROVIDERS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Mobile money number
            <input
              type="tel"
              placeholder="e.g. 097 XXX XXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="off"
            />
          </label>
          {error && <div className="error-text" role="alert">{error}</div>}
          <div className="field-row" style={{ marginTop: 4 }}>
            <button className="btn-ghost-dark" style={{ width: "auto" }} onClick={startConfirm}>
              {savedProvider ? "Update payout number" : "Save payout number"}
            </button>
          </div>
        </>
      )}
      {status && <p className="muted tiny">{status}</p>}
    </>
  );
}
