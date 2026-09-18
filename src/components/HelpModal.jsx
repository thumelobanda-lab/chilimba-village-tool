import React, { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import { getSupportContact } from "../lib/api.js";
import { buildWhatsAppDirectUrl } from "../lib/inviteCard.js";

const HELP_WHATSAPP_MESSAGE = "Hi, I need help with OpenBook.";

/**
 * Reachable from a single "Need help?" trigger in the header (see
 * App.jsx) — same one-shared-component pattern as PrivacyModal/TermsModal,
 * and the same owner-configured supportEmail/supportWhatsapp fields
 * TermsContent.jsx already reads (getSupportContact — public,
 * unauthenticated, works pre-login too, since a locked-out member needs
 * this most).
 */
export default function HelpModal({ onClose }) {
  const [contact, setContact] = useState({ supportEmail: null, supportWhatsapp: null });

  useEffect(() => {
    getSupportContact()
      .then(setContact)
      .catch(() => {}); // non-critical — the fallback copy below still reads fine without it
  }, []);

  const hasContact = contact.supportEmail || contact.supportWhatsapp;

  return (
    <div className="calc-modal-backdrop" onClick={onClose}>
      <div className="calc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calc-modal-header">
          <span>Need help?</span>
          <button className="calc-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="terms-modal-body">
          {hasContact ? (
            <>
              <p className="small">Reach OpenBook support directly:</p>
              <div className="invite-card-actions">
                {contact.supportEmail && (
                  <a className="btn-ghost-dark" href={`mailto:${contact.supportEmail}`}>
                    <Icon name="mail" size={16} className="icon-inline" /> {contact.supportEmail}
                  </a>
                )}
                {contact.supportWhatsapp && (
                  <a
                    className="btn-ghost-dark"
                    href={buildWhatsAppDirectUrl(contact.supportWhatsapp, HELP_WHATSAPP_MESSAGE)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="message" size={16} className="icon-inline" /> WhatsApp {contact.supportWhatsapp}
                  </a>
                )}
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
    </div>
  );
}
