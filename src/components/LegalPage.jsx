import React, { useEffect } from "react";
import OpenBookMark from "./OpenBookMark.jsx";
import TermsContent from "./TermsContent.jsx";
import PrivacyContent from "./PrivacyContent.jsx";

/**
 * Standalone, pre-login rendering of the same Terms/Privacy copy shown
 * in-app via TermsModal.jsx/PrivacyModal.jsx — mounted directly by
 * main.jsx (see its pathname check) at the stable /terms and /privacy
 * URLs a Play Store listing's privacy-policy field needs, since those
 * modals only ever open from inside the authenticated app shell.
 */
export default function LegalPage({ page }) {
  const isPrivacy = page === "privacy";

  useEffect(() => {
    document.title = `OpenBook — ${isPrivacy ? "Privacy Policy" : "Terms & Conditions"}`;
  }, [isPrivacy]);

  return (
    <div className="legal-page">
      <header className="legal-page-header">
        <OpenBookMark size={40} />
        <span className="legal-page-brand">OpenBook</span>
      </header>
      <main className="legal-page-body">
        <h1 className="legal-page-title">{isPrivacy ? "Privacy Policy" : "Terms & Conditions"}</h1>
        {isPrivacy ? <PrivacyContent /> : <TermsContent />}
      </main>
    </div>
  );
}
