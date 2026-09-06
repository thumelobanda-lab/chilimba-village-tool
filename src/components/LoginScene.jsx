import React from "react";

// Purely decorative — every value here is a static layout constant, no
// state, no data fetching, nothing that needs a hook. Four women, each
// carrying a different everyday load (firewood, a basket on the head,
// a basket at the hip, a water gourd), walk in from the edges and
// settle into a loose arc around a small glowing book — the "shared
// record" a Chilimba's payout rotation actually is. Kept as inline SVG
// (not an image asset) specifically so this adds zero extra network
// requests on a first load over mobile data; the whole scene is a few
// KB of markup already inside the JS bundle Login.jsx needed anyway.
// The walk-in motion itself is CSS animation (see .login-scene rules in
// styles.css), gated behind `prefers-reduced-motion: no-preference` —
// with that preference on, every figure just renders at its resting
// position with no animation at all, per that block's own comment.
const FIGURES = [
  { id: "a", load: "firewood", wrap: "#D4A94A", dress: "#9E5A48", left: "14%", anim: "login-scene-walk-left" },
  { id: "b", load: "head-basket", wrap: "#166B47", dress: "#D4A94A", left: "37%", anim: "login-scene-walk-top-left" },
  { id: "c", load: "hip-basket", wrap: "#9E5A48", dress: "#166B47", left: "61%", anim: "login-scene-walk-top-right" },
  { id: "d", load: "gourd", wrap: "#C3A47C", dress: "#9E5A48", left: "84%", anim: "login-scene-walk-right" },
];

function Load({ type }) {
  switch (type) {
    case "firewood":
      // A bundle of sticks, tied at the middle, balanced on the head.
      return (
        <g transform="translate(20 4)">
          <line x1="-9" y1="2" x2="9" y2="-3" stroke="#7A5230" strokeWidth="2" strokeLinecap="round" />
          <line x1="-9" y1="-1" x2="9" y2="1" stroke="#8C5F16" strokeWidth="2" strokeLinecap="round" />
          <line x1="-9" y1="-4" x2="9" y2="-1" stroke="#7A5230" strokeWidth="2" strokeLinecap="round" />
          <line x1="0" y1="-6" x2="0" y2="4" stroke="#5C4816" strokeWidth="1.5" />
        </g>
      );
    case "head-basket":
      // A woven basket of fruit, balanced on the head.
      return (
        <g transform="translate(20 2)">
          <ellipse cx="0" cy="2" rx="10" ry="5" fill="#C3A47C" stroke="#8C5F16" strokeWidth="1" />
          <circle cx="-4" cy="-3" r="3" fill="#B23B2A" />
          <circle cx="2" cy="-4" r="3" fill="#D4A94A" />
          <circle cx="6" cy="-2" r="2.5" fill="#3F6B2E" />
        </g>
      );
    case "hip-basket":
      // Vegetables in a basket, carried at the hip, not the head.
      return (
        <g transform="translate(11 34)">
          <ellipse cx="0" cy="0" rx="7" ry="6" fill="#C3A47C" stroke="#8C5F16" strokeWidth="1" />
          <circle cx="-2" cy="-4" r="2.4" fill="#3F6B2E" />
          <circle cx="3" cy="-5" r="2" fill="#D4A94A" />
        </g>
      );
    case "gourd":
      // A calabash water gourd, balanced on the head.
      return (
        <g transform="translate(20 1)">
          <ellipse cx="0" cy="3" rx="6.5" ry="5" fill="#8C5F16" />
          <ellipse cx="0" cy="-2" rx="4" ry="3.5" fill="#8C5F16" />
        </g>
      );
    default:
      return null;
  }
}

function Figure({ load, wrap, dress, left, anim, delay }) {
  const hipLoad = load === "hip-basket";
  return (
    <div
      className={"login-scene-figure " + anim}
      style={{ left, animationDelay: delay }}
    >
      <svg viewBox="0 0 40 70" width="34" height="60" aria-hidden="true">
        {/* Dress — a long wrap skirt, wide at the hem, same silhouette for
            every figure; only its color and the load it's paired with change. */}
        <path d="M12 30 L28 30 L34 66 L6 66 Z" fill={dress} />
        <circle cx="12" cy="60" r="2.4" fill={dress} opacity="0.8" />
        <circle cx="28" cy="62" r="2.4" fill={dress} opacity="0.8" />
        <circle cx="20" cy="58" r="2.4" fill={dress} opacity="0.8" />
        {/* Feet, offset to read as mid-stride rather than standing still. */}
        <ellipse cx="14" cy="67" rx="4" ry="2" fill="#4F3620" />
        <ellipse cx="26" cy="68" rx="4" ry="2" fill="#4F3620" />
        {/* Arm — bent up to steady a head-load, or bent out to hold a hip
            basket; the rest of the figures' arms rest at the side. */}
        {hipLoad ? (
          <path d="M14 34 Q6 40 9 48" stroke="#6B4A34" strokeWidth="4" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M14 32 Q10 22 18 16" stroke="#6B4A34" strokeWidth="4" fill="none" strokeLinecap="round" />
        )}
        <path d="M26 32 Q30 40 27 48" stroke="#6B4A34" strokeWidth="4" fill="none" strokeLinecap="round" />
        {/* Torso + head */}
        <path d="M14 12 Q20 6 26 12 L28 30 L12 30 Z" fill="#6B4A34" />
        <circle cx="20" cy="10" r="7" fill="#6B4A34" />
        {/* Headwrap */}
        <path d="M13 8 Q20 -1 27 8 Q27 4 20 3 Q13 4 13 8 Z" fill={wrap} />
        <Load type={load} />
      </svg>
    </div>
  );
}

export default function LoginScene() {
  return (
    <div className="login-scene" role="img" aria-label="Illustration of women from the group walking in together, carrying firewood and baskets, gathering around OpenBook's shared ledger">
      <div className="login-scene-ground" />
      {FIGURES.map((f, i) => (
        <Figure key={f.id} load={f.load} wrap={f.wrap} dress={f.dress} left={f.left} anim={f.anim} delay={`${i * 0.22}s`} />
      ))}
      <div className="login-scene-book" aria-hidden="true">
        <svg viewBox="0 0 48 32" width="42" height="28">
          <path d="M24 6 L4 3 L4 27 L24 30 Z" fill="#FAF7F0" stroke="#D4A94A" strokeWidth="1.5" />
          <path d="M24 6 L44 3 L44 27 L24 30 Z" fill="#FAF7F0" stroke="#D4A94A" strokeWidth="1.5" />
          <line x1="24" y1="6" x2="24" y2="30" stroke="#D4A94A" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}
