import React, { useEffect, useRef, useState } from "react";
import { updateProfile, uploadProfilePhoto, removeProfilePhoto, getProfilePhotoUrl } from "../lib/api.js";
import { resizeImageForUpload } from "../lib/imageResize.js";
import Avatar from "./Avatar.jsx";
import TermsModal from "./TermsModal.jsx";
import PrivacyModal from "./PrivacyModal.jsx";
import Toast from "./Toast.jsx";
import FreeTierBanner from "./FreeTierBanner.jsx";

// Self-service editing of the signed-in member's own account. Deliberately
// scoped to just two things: a cosmetic display-name fix (spelling/
// capitalization only — see updateProfile()'s validation for why a real
// rename isn't offered here) and changing your own PIN. Nothing here can
// touch another member's account — updateProfile() always acts on the
// signed-in session, never a name passed in from outside.
export default function Profile({ session, onRenamed, onLogout, subscriptionStatus, onUpgrade }) {
  const [displayName, setDisplayName] = useState(session.name);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const fileInputRef = useRef(null);

  // One fetch for the signed-in member's own photo — unlike a roster
  // (many members, so Avatar.jsx only fetches when a hasPhoto flag says
  // there's something to get), this is always exactly one member, so
  // there's no "wasted round trip for everyone with no photo" concern
  // to guard against by pre-checking first.
  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    getProfilePhotoUrl(session.name).then((url) => {
      if (cancelled) return;
      objectUrl = url;
      setPhotoUrl(url);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [session.name]);

  const handlePhotoSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets picking the same file again re-fire onChange
    if (!file) return;
    setPhotoError("");
    setPhotoBusy(true);
    try {
      const resized = await resizeImageForUpload(file);
      await uploadProfilePhoto(resized);
      setPhotoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(resized);
      });
      setStatus("Saved");
    } catch (err) {
      setPhotoError(err.message || "Could not upload your photo.");
    } finally {
      setPhotoBusy(false);
      setTimeout(() => setStatus(""), 1500);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoError("");
    setPhotoBusy(true);
    try {
      await removeProfilePhoto();
      setPhotoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setStatus("Saved");
    } catch (err) {
      setPhotoError(err.message || "Could not remove your photo.");
    } finally {
      setPhotoBusy(false);
      setTimeout(() => setStatus(""), 1500);
    }
  };

  const nameChanged = displayName.trim() !== session.name && displayName.trim().length > 0;
  const wantsPinChange = !!(currentPin || newPin || confirmPin);

  const save = async () => {
    setError("");
    if (!nameChanged && !wantsPinChange) {
      setError("Change your name or fill in the PIN fields first.");
      return;
    }
    if (wantsPinChange) {
      if (!currentPin) {
        setError("Enter your current PIN to set a new one.");
        return;
      }
      if (newPin.length < 4) {
        setError("New PIN must be at least 4 digits.");
        return;
      }
      if (newPin !== confirmPin) {
        setError("New PIN and confirmation don't match.");
        return;
      }
    }

    setBusy(true);
    try {
      const result = await updateProfile({
        displayName: nameChanged ? displayName.trim() : undefined,
        currentPin: wantsPinChange ? currentPin : undefined,
        newPin: wantsPinChange ? newPin : undefined,
      });
      if (result?.name) onRenamed?.(result.name);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setStatus("Saved");
    } catch (e) {
      setError(e.message || "Could not save your changes.");
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(""), 1500);
    }
  };

  return (
    <div className="panel">
      <h2 className="panel-title">My Account</h2>
      <p className="muted small">
        Update how your name is shown, or change your PIN. This only ever affects your own
        account — nobody else's info is touched.
      </p>

      {/* Moved off the dashboard — it was permanent, always-visible real
          estate for a state (free tier) that's true indefinitely until an
          admin upgrades, competing with the four things Dashboard.jsx's
          own doc comment says are meant to fit one screen. My Account is
          still somewhere every member passes through, just not the very
          first thing they see every time. */}
      <FreeTierBanner
        status={subscriptionStatus}
        isAdmin={session.role === "admin"}
        onUpgrade={onUpgrade}
      />

      <h3 className="panel-subtitle">Your Photo</h3>
      <p className="muted tiny" style={{ marginBottom: 10 }}>
        Visible to everyone in your group, same as the payout roster. Uploading a photo counts
        as agreeing to that.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <Avatar name={session.name} photoDataUrl={photoUrl} size={64} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="field-row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn-ghost-dark"
              style={{ width: "auto" }}
              disabled={photoBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              {photoBusy ? "Working…" : photoUrl ? "Change photo" : "Upload photo"}
            </button>
            {photoUrl && (
              <button
                type="button"
                className="btn-link"
                disabled={photoBusy}
                onClick={handleRemovePhoto}
              >
                Remove
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoSelected}
            style={{ display: "none" }}
          />
        </div>
      </div>
      {photoError && <div className="error-text" role="alert">{photoError}</div>}

      <label className="field">
        Display name
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={busy}
        />
      </label>
      <p className="muted tiny" style={{ marginTop: -6, marginBottom: 14 }}>
        You can fix spelling or capitalization here. To change to a genuinely different
        name, ask a group leader — your name is also how the payout schedule recognizes you.
      </p>

      <h3 className="panel-subtitle">Change PIN</h3>
      <button
        type="button"
        className="btn-link"
        disabled
        title="Self-service PIN reset by SMS is coming soon."
      >
        Forgot your PIN?
      </button>
      <p className="muted tiny" style={{ marginTop: 2, marginBottom: 14 }}>
        Self-service reset by SMS is coming soon. For now, ask a group leader to reset it for
        you — they can do this from Group Setup.
      </p>
      <label className="field">
        Current PIN
        <input
          type="password"
          inputMode="numeric"
          value={currentPin}
          onChange={(e) => setCurrentPin(e.target.value)}
          placeholder="••••"
          autoComplete="current-password"
          disabled={busy}
        />
      </label>
      <div className="field-row">
        <label className="field">
          New PIN (4+ digits)
          <input
            type="password"
            inputMode="numeric"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            placeholder="••••"
            autoComplete="new-password"
            disabled={busy}
          />
        </label>
        <label className="field">
          Confirm new PIN
          <input
            type="password"
            inputMode="numeric"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            placeholder="••••"
            autoComplete="new-password"
            disabled={busy}
          />
        </label>
      </div>

      {error && <div className="error-text" role="alert">{error}</div>}

      <div className="field-row" style={{ marginTop: 10 }}>
        <button className="btn-primary" style={{ width: "auto" }} disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
      <Toast message={status} />

      <div className="privacy-row">
        <button className="btn-link" onClick={() => setShowTerms(true)}>Terms &amp; Conditions</button>
        <button className="btn-link" onClick={() => setShowPrivacy(true)}>Privacy Policy</button>
      </div>
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}

      {onLogout && (
        <div className="account-signout-row">
          <button className="btn-ghost-dark" onClick={onLogout}>Log out</button>
        </div>
      )}
    </div>
  );
}
