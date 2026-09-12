import React from "react";
import PrivacyContent from "./PrivacyContent.jsx";

/**
 * Same one-shared-component pattern as TermsModal.jsx (see its doc
 * comment) — opened from the sign-up screen and from a permanent link
 * in Profile.jsx, never two separate copies of the text.
 */
export default function PrivacyModal({ onClose }) {
  return (
    <div className="calc-modal-backdrop" onClick={onClose}>
      <div className="calc-modal terms-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calc-modal-header">
          <span>Privacy Policy</span>
          <button className="calc-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="terms-modal-body">
          <PrivacyContent />
        </div>
      </div>
    </div>
  );
}
