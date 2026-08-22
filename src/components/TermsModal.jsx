import React from "react";
import TermsContent from "./TermsContent.jsx";

/**
 * Opened from two places, on purpose sharing this one component so
 * there's never a second, drifting copy of the terms text: the sign-up
 * checkbox in Login.jsx/CreateGroup.jsx (point 3 — view before agreeing)
 * and the permanent "Terms & Conditions" link in Profile.jsx (point 4 —
 * accessible any time after signup, not just a one-time gate).
 */
export default function TermsModal({ onClose }) {
  return (
    <div className="calc-modal-backdrop" onClick={onClose}>
      <div className="calc-modal terms-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calc-modal-header">
          <span>Terms &amp; Conditions</span>
          <button className="calc-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="terms-modal-body">
          <TermsContent />
        </div>
      </div>
    </div>
  );
}
