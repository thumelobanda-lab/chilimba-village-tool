import React from "react";

// Purely decorative — every value here is a static layout constant, no
// state, no data fetching, nothing that needs a hook. Four women walk in
// from the edges and settle into a loose arc around a small glowing book
// — the "shared record" a Chilimba's payout rotation actually is. Each
// one is a distinct person, not the same silhouette recolored: different
// height, posture, and load, matched to a gait that reads through the
// entrance animation (see the per-figure bounce keyframes in styles.css)
// — one walking steadily, one limping and leaning on a stick, one
// stooped and slow, one leaning back under a heavier bundle. Kept as
// inline SVG (not an image asset) so this adds zero extra network
// requests on a first load over mobile data; the whole scene is a few KB
// of markup already inside the JS bundle Login.jsx needed anyway.
const FIGURES = [
  {
    id: "a",
    gait: "steady",
    skin: "#6B4A34",
    top: "#B5651D",
    dress: "#D4A94A",
    underDress: "#8C5F16",
    left: "14%",
    anim: "login-scene-walk-left",
    bounce: "login-scene-bounce-steady",
    duration: "1.1s",
  },
  {
    id: "b",
    gait: "limping",
    skin: "#5C3E2E",
    top: "#9E5A48",
    dress: "#C3A47C",
    underDress: "#8C5F16",
    left: "37%",
    anim: "login-scene-walk-top-left",
    bounce: "login-scene-bounce-limp",
    duration: "1.3s",
  },
  {
    id: "c",
    gait: "stooped",
    skin: "#7A5230",
    top: "#C3A47C",
    dress: "#9E5A48",
    underDress: "#7A5230",
    left: "61%",
    anim: "login-scene-walk-top-right",
    bounce: "login-scene-bounce-stooped",
    duration: "1.5s",
  },
  {
    id: "d",
    gait: "heavy",
    skin: "#4F3620",
    top: "#7A5230",
    dress: "#8C5F16",
    underDress: "#5C3E2E",
    left: "84%",
    anim: "login-scene-walk-right",
    bounce: "login-scene-bounce-heavy",
    duration: "1.4s",
  },
];

// A steady, upright walker carrying firewood — the confident baseline
// gait the other three are meant to read as departures from. Skirt hem
// is cut open at the front on the stepping leg so a bare shin shows
// mid-stride, the one figure in this set drawn that way.
function SteadyWalker({ skin, top, dress, underDress }) {
  return (
    <svg viewBox="0 0 40 78" width="34" height="66" aria-hidden="true">
      <path d="M25 34 Q31 39 28 47" stroke={skin} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M12 30 L28 30 L33 62 L22 70 L18 70 L7 62 Z" fill={dress} />
      <path d="M16 58 L26 58 L28 66 L14 66 Z" fill={underDress} opacity="0.9" />
      <path d="M17 60 L22 60 L20 70 L18 70 Z" fill={skin} />
      <ellipse cx="19" cy="72" rx="4" ry="2" fill="#3D2A1C" />
      <ellipse cx="9" cy="65" rx="3.2" ry="1.8" fill="#3D2A1C" />
      <rect x="12" y="28" width="16" height="3" rx="1.5" fill={underDress} opacity="0.85" />
      <path d="M15 32 Q9 22 17 15" stroke={skin} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M14 12 Q20 6 26 12 L28 30 L12 30 Z" fill={top} />
      <circle cx="20" cy="10" r="7" fill={skin} />
      <path d="M13 8 Q20 -1 27 8 Q27 4 20 3 Q13 4 13 8 Z" fill={dress} />
      <path d="M26 6 L31 9 L26 10 Z" fill={dress} />
      <g transform="translate(20 4)">
        <line x1="-10" y1="2" x2="10" y2="-3" stroke="#7A5230" strokeWidth="2" strokeLinecap="round" />
        <line x1="-10" y1="-1" x2="10" y2="1" stroke="#8C5F16" strokeWidth="2" strokeLinecap="round" />
        <line x1="-10" y1="-4" x2="10" y2="-1" stroke="#7A5230" strokeWidth="2" strokeLinecap="round" />
        <line x1="0" y1="-6" x2="0" y2="4" stroke="#5C4816" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

// Leaning on a stick, one leg trailing and turned in — the limp reads
// through the uneven feet and the torso tilted toward the stick side,
// not just a label. Carries her load at the hip, steadied with her free
// hand, since a hip basket is the one load shape that still works when
// a hand is busy with a stick.
function LimpingWalker({ skin, top, dress, underDress }) {
  return (
    <svg viewBox="0 0 38 70" width="30" height="58" aria-hidden="true">
      <line x1="9" y1="46" x2="6" y2="68" stroke="#5C4020" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="9" cy="45" r="1.8" fill="#5C4020" />
      <g transform="rotate(6 19 30)">
        <path d="M11 30 L27 30 L30 56 L22 63 L15 66 L8 55 Z" fill={dress} />
        <path d="M14 54 L23 54 L24 61 L15 62 Z" fill={underDress} opacity="0.9" />
        <ellipse cx="13" cy="65" rx="4" ry="2" fill="#3D2A1C" />
        <ellipse cx="24" cy="59" rx="3" ry="1.6" fill="#3D2A1C" transform="rotate(18 24 59)" />
        <path d="M13 34 Q7 39 9 46" stroke={skin} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M23 34 Q29 37 27 43" stroke={skin} strokeWidth="4" fill="none" strokeLinecap="round" />
        <g transform="translate(28 44)">
          <ellipse cx="0" cy="0" rx="6.5" ry="5.5" fill="#C3A47C" stroke="#8C5F16" strokeWidth="1" />
          <circle cx="-2" cy="-3.5" r="2.2" fill="#3F6B2E" />
          <circle cx="2.5" cy="-4.5" r="1.8" fill="#D4A94A" />
        </g>
        <path d="M13 12 Q19 6 25 12 L27 30 L11 30 Z" fill={top} />
        <circle cx="19" cy="10" r="6.5" fill={skin} />
        <path d="M12.5 8 Q19 -0.5 25.5 8 Q25.5 4 19 3 Q12.5 4 12.5 8 Z" fill={dress} />
      </g>
    </svg>
  );
}

// Stooped forward from the hip, head bowed, small close-together steps —
// age and fatigue rather than injury. The forward lean is a real
// rotation around the hip, not just a hunched shoulder, so the whole
// upper body reads as bent, and the reach up to the basket is short and
// tired rather than a confident steadying grip.
function StoopedWalker({ skin, top, dress, underDress }) {
  return (
    <svg viewBox="0 0 36 64" width="26" height="52" aria-hidden="true">
      <path d="M9 28 L23 28 L26 52 L19 58 L14 58 L6 52 Z" fill={dress} />
      <path d="M12 48 L21 48 L22.5 55 L11.5 55 Z" fill={underDress} opacity="0.9" />
      <ellipse cx="14" cy="57" rx="3.6" ry="1.8" fill="#3D2A1C" />
      <ellipse cx="19" cy="58" rx="3.6" ry="1.8" fill="#3D2A1C" />
      <g transform="rotate(13 16 28)">
        <path d="M20 15 Q23 20 19 25" stroke={skin} strokeWidth="3.4" fill="none" strokeLinecap="round" />
        <path d="M9 15 Q6 10 10 4" stroke={skin} strokeWidth="3.4" fill="none" strokeLinecap="round" />
        <path d="M9 13 L21 13 L23 28 L8 28 Z" fill={top} />
        <path d="M13 13 Q11 9 13 6" stroke={skin} strokeWidth="5" fill="none" strokeLinecap="round" />
        <circle cx="13" cy="6" r="6" fill={skin} />
        <path d="M8 4 Q13 -3 18 4 Q18 1 13 0 Q8 1 8 4 Z" fill={dress} />
        <g transform="translate(13 -1)">
          <ellipse cx="0" cy="2" rx="8" ry="4" fill="#C3A47C" stroke="#8C5F16" strokeWidth="1" />
          <circle cx="-3" cy="-2" r="2.4" fill="#B23B2A" />
          <circle cx="2" cy="-3" r="2.4" fill="#3F6B2E" />
        </g>
      </g>
    </svg>
  );
}

// Broad stance, both arms braced overhead, leaning back into the weight
// — the counterbalance a genuinely heavy head-load forces, not just a
// bigger prop. The bundle itself is drawn wider and paired with a
// second smaller load knotted on to sell "heavier", not just "bigger".
function HeavyLoadWalker({ skin, top, dress, underDress }) {
  return (
    <svg viewBox="0 0 46 78" width="38" height="66" aria-hidden="true">
      <path d="M14 32 L32 32 L38 70 L8 70 Z" fill={dress} />
      <path d="M18 62 L28 62 L30 68 L16 68 Z" fill={underDress} opacity="0.9" />
      <ellipse cx="14" cy="72" rx="5" ry="2.2" fill="#3D2A1C" />
      <ellipse cx="31" cy="72" rx="5" ry="2.2" fill="#3D2A1C" />
      <rect x="13" y="30" width="20" height="3.4" rx="1.6" fill={underDress} opacity="0.85" />
      <g transform="rotate(-8 23 32)">
        <path d="M13 32 Q6 26 9 15" stroke={skin} strokeWidth="4.6" fill="none" strokeLinecap="round" />
        <path d="M33 32 Q40 26 37 15" stroke={skin} strokeWidth="4.6" fill="none" strokeLinecap="round" />
        <path d="M12 10 Q23 2 34 10 L36 32 L10 32 Z" fill={top} />
        <circle cx="23" cy="11" r="7.6" fill={skin} />
        <path d="M15 9 Q23 -1 31 9 Q31 4 23 3 Q15 4 15 9 Z" fill={dress} />
        <path d="M30 6 L36 10 L30 11 Z" fill={dress} />
        <g transform="translate(23 3)">
          <ellipse cx="0" cy="1" rx="15" ry="6.5" fill="#C3A47C" stroke="#8C5F16" strokeWidth="1.2" />
          <ellipse cx="10" cy="-2" rx="5" ry="4.2" fill="#8C5F16" />
          <line x1="-13" y1="0" x2="13" y2="0" stroke="#5C4816" strokeWidth="1.4" />
        </g>
      </g>
    </svg>
  );
}

function Figure({ gait, skin, top, dress, underDress, left, anim, bounce, duration, delay }) {
  const Body =
    gait === "limping" ? LimpingWalker : gait === "stooped" ? StoopedWalker : gait === "heavy" ? HeavyLoadWalker : SteadyWalker;
  return (
    <div
      className={"login-scene-figure " + anim}
      style={{ left, animationDelay: delay, animationDuration: duration }}
    >
      <div className={"login-scene-figure-bounce " + bounce} style={{ animationDelay: delay }}>
        <Body skin={skin} top={top} dress={dress} underDress={underDress} />
      </div>
    </div>
  );
}

export default function LoginScene() {
  return (
    <div
      className="login-scene"
      role="img"
      aria-label="Illustration of four women from the group walking in together — one walking steadily with firewood, one limping and leaning on a stick with a basket at her hip, one stooped and walking slowly with a basket on her head, one leaning back under a heavier bundle — gathering around OpenBook's shared ledger"
    >
      <div className="login-scene-ground" />
      {FIGURES.map((f, i) => (
        <Figure key={f.id} {...f} delay={`${i * 0.22}s`} />
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
