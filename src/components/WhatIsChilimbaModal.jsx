import React from "react";

// One term, many names — a member arriving from a different diaspora/
// region may know this exact practice under a completely different word
// and otherwise wonder if OpenBook is something unfamiliar. Purely
// informational, same shared modal chrome as HelpModal/TermsModal.
const OTHER_NAMES = [
  { term: "ROSCA", place: "the general term" },
  { term: "Stokvel", place: "South Africa" },
  { term: "Susu", place: "Ghana / West Africa / the Caribbean" },
  { term: "Esusu / Ajo", place: "Nigeria" },
  { term: "Tontine", place: "French-speaking Africa" },
  { term: "Chit fund", place: "India" },
  { term: "Hui", place: "China" },
  { term: "Paluwagan", place: "the Philippines" },
  { term: "Tanda / Cundina", place: "Mexico" },
  { term: "Gam'eya", place: "Egypt / the Arab world" },
];

export default function WhatIsChilimbaModal({ onClose }) {
  return (
    <div className="calc-modal-backdrop" onClick={onClose}>
      <div className="calc-modal terms-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calc-modal-header">
          <span>What is a Chilimba?</span>
          <button className="calc-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="terms-modal-body">
          <p className="small">
            A Chilimba is a rotating savings circle: a group of people who each contribute
            the same amount on a shared schedule, and on each date one or more members
            receive the whole round's contributions as a payout. Everyone puts in, everyone
            eventually takes out — the group keeps going as long as its members do.
          </p>
          <p className="small" style={{ marginTop: 10 }}>
            It's a Zambian term, but the same practice exists worldwide under different
            names:
          </p>
          <ul className="chilimba-names-list">
            {OTHER_NAMES.map((n) => (
              <li key={n.term}>
                <strong>{n.term}</strong> <span className="muted">— {n.place}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
