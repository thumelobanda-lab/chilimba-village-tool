import React, { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import WhatIsChilimbaModal from "./WhatIsChilimbaModal.jsx";
import { getSupportContact } from "../lib/api.js";

/**
 * Reachable from a single "Need help?" trigger in the header (see
 * App.jsx) — same one-shared-component pattern as PrivacyModal/TermsModal,
 * and the same owner-configured supportEmail field TermsContent.jsx
 * already reads (getSupportContact — public, unauthenticated, works
 * pre-login too, since a locked-out member needs this most). Email only,
 * not supportWhatsapp — this card is a quiet fallback for "who do I
 * contact," not another channel to keep in sync; TermsContent.jsx and the
 * owner's own messaging tools still use WhatsApp where that's the point.
 */
export default function HelpModal({ onClose }) {
  const [contact, setContact] = useState({ supportEmail: null });
  const [showWhatIsChilimba, setShowWhatIsChilimba] = useState(false);

  useEffect(() => {
    getSupportContact()
      .then(setContact)
      .catch(() => {}); // non-critical — the fallback copy below still reads fine without it
  }, []);

  const hasContact = !!contact.supportEmail;

  return (
    <div className="calc-modal-backdrop" onClick={onClose}>
      <div className="calc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calc-modal-header">
          <span>Need help?</span>
          <button className="calc-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="terms-modal-body">
          <button
            type="button"
            className="btn-link"
            style={{ display: "block", marginBottom: 14 }}
            onClick={() => setShowWhatIsChilimba(true)}
          >
            <Icon name="info" size={14} className="icon-inline" /> New here? What is a Chilimba?
          </button>
          {hasContact ? (
            <>
              <p className="small">Reach OpenBook support directly:</p>
              <div className="invite-card-actions">
                <a className="btn-ghost-dark" href={`mailto:${contact.supportEmail}`}>
                  <Icon name="mail" size={16} className="icon-inline" /> {contact.supportEmail}
                </a>
              </div>
            </>
          ) : (
            <p className="small">
              For most questions — a payment that looks wrong, a payout date, anything about
              how your group runs — your group's leader is the fastest place to start. For
              anything about the app itself, OpenBook's support contact hasn't been set up for
              this group yet.
            </p>
          )}
        </div>
      </div>
      {showWhatIsChilimba && <WhatIsChilimbaModal onClose={() => setShowWhatIsChilimba(false)} />}
    </div>
  );
}
