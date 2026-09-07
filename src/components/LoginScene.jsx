import React from "react";

// Purely decorative — every value here is a static layout constant, no
// state, no data fetching, nothing that needs a hook.
//
// Four women converge on a shared ledger at sunset. Each walks in along
// her own worn path (see TRACKS below) toward the mat/ledger/lamp at the
// convergence point, then settles into a loose ring around it, sets her
// load down, and turns in toward the book. The whole thing is one SVG
// document (not HTML divs over a background image) so every figure's
// `offset-path` can share the exact same coordinate space — and the
// exact same `d` string — as the visible track it walks along; drawn
// path and walking path can never diverge because they're the same
// string, not two hand-tuned copies of the same curve.
//
// Colors here are hardcoded, not theme tokens — this is a sunset/emerald
// illustration, not chrome; it must look identical in light and dark
// mode (see the "Scene colours are hardcoded" note in the PR — the rest
// of the app inverts for dark mode, this deliberately doesn't).
//
// Timeline (see styles.css's `.login-scene-*` rules for the actual
// keyframes — this comment is the map):
//   0.0–0.6s  scene (sky/ground/paths/mat/ledger) is simply visible;
//             only the lamp's glow fades up, establishing the
//             destination before anyone arrives.
//   0.6–2.6s  all four women enter at once, each riding her own track
//             via `offset-path`/`offset-distance` (100% → ~28%), scaling
//             0.28 → ~0.6 and fading 0.5 → 1 as they approach, with a
//             small per-gait walking bob layered on top via a separate
//             nested element (two CSS animations can't both drive
//             `transform` on the same element without one clobbering
//             the other).
//   2.6–3.5s  each one turns slightly inward, lowers her raised
//             arm+load down beside her feet, and (two of them) extends
//             her other arm toward the ledger. Everything holds at 3.5s
//             — no looping — since that settled ring is the frame most
//             users actually sit and look at.
//
// `prefers-reduced-motion: reduce` (or a browser with no support for
// `offset-path`) never sees any of the above: the default/unqualified
// CSS below places every figure directly at her settled ring position,
// load already down, facing in. The entrance/settle animations are
// added *only* inside `@media (prefers-reduced-motion: no-preference)`,
// same pattern the rest of this scene already used.

// The four worn paths, fanning out from CONVERGENCE toward the bottom
// edge. Each `d` string here is reused twice: once to draw the visible
// `<path>` track, once as the literal `offset-path` value for the
// figure that walks it — see TRACKS below, consumed directly by both
// call sites, never retyped.
const CONVERGENCE = { x: 200, y: 108 };
// Every track shares the same 0.55 bow ratio (control point = midpoint
// of start/end, nudged outward by 55% of the endpoints' x-distance) so
// the four curve the same amount relative to their own length — without
// this, the two inner (nearly-straight) tracks and two outer (long,
// swept) ones don't just differ in length, they differ enough that the
// same offset-distance % lands the inner walkers on top of the ledger
// while the outer ones are still comfortably spaced. See RING below,
// whose x/y were solved (not eyeballed) against these exact curves.
const TRACKS = {
  a: "M200,108 Q106.5,132.5 30,157",
  b: "M200,108 Q161.5,132.5 130,157",
  c: "M200,108 Q238.5,132.5 270,157",
  d: "M200,108 Q293.5,132.5 370,157",
};

// Settled ring position for each figure — both the reduced-motion
// default (the only frame those users see) and, for the motion-enabled
// path, where offset-distance stops (see FIGURES[].walkEnd and
// styles.css). The two don't need to be pixel-identical; they only both
// need to read as "a loose ring around the mat," clear of the ledger.
const RING = {
  a: { x: 139, y: 125 },
  b: { x: 172, y: 127 },
  c: { x: 228, y: 127 },
  d: { x: 261, y: 125 },
};

const FIGURES = [
  {
    id: "a",
    gait: "steady",
    mirror: false,
    reach: true,
    scale: 0.64,
    walkEnd: "36%",
    w: 40,
    h: 78,
    skin: "#6B4A34",
    top: "#B5651D",
    dress: "#D4A94A",
    underDress: "#8C5F16",
  },
  {
    id: "b",
    gait: "limping",
    mirror: false,
    reach: false,
    scale: 0.58,
    walkEnd: "40%",
    w: 38,
    h: 70,
    skin: "#5C3E2E",
    top: "#9E5A48",
    dress: "#C3A47C",
    underDress: "#8C5F16",
  },
  {
    id: "c",
    gait: "stooped",
    mirror: true,
    reach: true,
    scale: 0.56,
    walkEnd: "40%",
    w: 36,
    h: 64,
    skin: "#7A5230",
    top: "#C3A47C",
    dress: "#9E5A48",
    underDress: "#7A5230",
  },
  {
    id: "d",
    gait: "heavy",
    mirror: true,
    reach: false,
    scale: 0.62,
    walkEnd: "36%",
    w: 46,
    h: 78,
    skin: "#4F3620",
    top: "#7A5230",
    dress: "#8C5F16",
    underDress: "#5C3E2E",
  },
];

// Eye/nose/ear/chin-shadow, positioned relative to a head circle at
// (cx, cy) with radius r. Every walker is drawn facing local +x
// ("right"); figures whose track lands them on the right half of the
// scene mirror their whole body (scaleX(-1) on .login-scene-figure-scale,
// see FIGURES[].mirror) rather than needing a second, mirrored copy of
// this face drawn by hand.
function ProfileFace({ cx, cy, r, skin }) {
  return (
    <g>
      <ellipse cx={cx - r * 0.72} cy={cy + r * 0.08} rx={r * 0.26} ry={r * 0.36} fill={skin} />
      {/* A small filled bump, not a stroked line poking off the circle —
          its base sits inside the head circle's own radius so the two
          shapes merge into one silhouette instead of reading as a
          separate beak-like appendage stuck on the side. */}
      <path
        d={`M${cx + r * 0.98},${cy - r * 0.02} L${cx + r * 0.74},${cy - r * 0.18} L${cx + r * 0.74},${cy + r * 0.15} Z`}
        fill={skin}
      />
      <circle cx={cx + r * 0.32} cy={cy - r * 0.14} r={Math.max(r * 0.13, 0.6)} fill="#241E14" />
      <path
        d={`M${cx + r * 0.15},${cy + r * 0.68} q${r * 0.35},${r * 0.16} ${r * 0.6},0`}
        stroke="rgba(20,14,8,0.22)"
        strokeWidth={r * 0.12}
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

// Fingers curling over a load's edge at (x, y), rotated to `angle` so
// they read as gripping rather than floating near it — the tips land
// past the load's own outline, not stopping short of it.
function GripFingers({ x, y, angle, skin }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <line x1="0" y1="0" x2="-1.2" y2="5.2" stroke={skin} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="2" y1="0" x2="2" y2="5.8" stroke={skin} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="4" y1="0.4" x2="5" y2="5.2" stroke={skin} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

function FirewoodBundle({ scale = 1 }) {
  return (
    <g transform={`scale(${scale})`}>
      <line x1="-11" y1="2" x2="11" y2="-3" stroke="#7A5230" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="-11" y1="-1" x2="11" y2="1" stroke="#8C5F16" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="-11" y1="-4" x2="11" y2="-1" stroke="#7A5230" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="-9" y1="4.5" x2="9" y2="-5.5" stroke="#6B4423" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      <line x1="0" y1="-6" x2="0" y2="5" stroke="#5C4816" strokeWidth="1.6" />
    </g>
  );
}

function ProduceBasket({ scale = 1 }) {
  return (
    <g transform={`scale(${scale})`}>
      <ellipse cx="0" cy="0" rx="9" ry="6.2" fill="#C3A47C" stroke="#8C5F16" strokeWidth="1.1" />
      <circle cx="-3" cy="-3" r="2.1" fill="#B23B2A" />
      <circle cx="2.5" cy="-4" r="1.9" fill="#3F6B2E" />
      <circle cx="-0.5" cy="-1.5" r="1.7" fill="#D4A94A" />
    </g>
  );
}

// Upright, even stride, firewood on the head — the confident baseline
// gait the other three read as departures from. Her free arm (hanging
// at her side while she walks) is the one that reaches for the ledger
// once she settles.
function SteadyWalker({ skin, top, dress, underDress }) {
  return (
    <>
      <g className="login-scene-reach-arm login-scene-reach-arm-a">
        <path d="M25 34 Q31 39 28 47" stroke={skin} strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
      <path d="M12 30 L28 30 L33 62 L22 70 L18 70 L7 62 Z" fill={dress} />
      <path d="M16 58 L26 58 L28 66 L14 66 Z" fill={underDress} opacity="0.9" />
      <path d="M17 60 L22 60 L20 70 L18 70 Z" fill={skin} />
      <ellipse cx="19" cy="72" rx="4" ry="2" fill="#3D2A1C" />
      <ellipse cx="9" cy="65" rx="3.2" ry="1.8" fill="#3D2A1C" />
      <rect x="12" y="28" width="16" height="3" rx="1.5" fill={underDress} opacity="0.85" />
      <path d="M14 12 Q20 6 26 12 L28 30 L12 30 Z" fill={top} />
      <circle cx="20" cy="10" r="7" fill={skin} />
      <ProfileFace cx={20} cy={10} r={7} skin={skin} />
      <path d="M13 8 Q20 -1 27 8 Q27 4 20 3 Q13 4 13 8 Z" fill={dress} />
      <path d="M26 6 L31 9 L26 10 Z" fill={dress} />
      <g className="login-scene-arm-load login-scene-arm-load-a">
        <path d="M15 32 Q9 22 17 15" stroke={skin} strokeWidth="4" fill="none" strokeLinecap="round" />
        <g transform="translate(20 4)">
          <FirewoodBundle />
        </g>
        <GripFingers x={16.5} y={12.5} angle={-40} skin={skin} />
      </g>
    </>
  );
}

// A limp read through uneven feet and a torso tilted toward the stick
// side, not a label. The stick stays in her lower hand the whole time —
// she's not one of the two who extends a hand at the end, the stick
// makes that read wrong — while her other arm carries a basket up on
// her head like the rest.
function LimpingWalker({ skin, top, dress, underDress }) {
  return (
    <g transform="rotate(6 19 30)">
      <line x1="9" y1="46" x2="6" y2="68" stroke="#5C4020" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="9" cy="45" r="1.8" fill="#5C4020" />
      <path d="M13 34 Q7 39 9 46" stroke={skin} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M11 30 L27 30 L30 56 L22 63 L15 66 L8 55 Z" fill={dress} />
      <path d="M14 54 L23 54 L24 61 L15 62 Z" fill={underDress} opacity="0.9" />
      <ellipse cx="13" cy="65" rx="4" ry="2" fill="#3D2A1C" />
      <ellipse cx="24" cy="59" rx="3" ry="1.6" fill="#3D2A1C" transform="rotate(18 24 59)" />
      <path d="M13 12 Q19 6 25 12 L27 30 L11 30 Z" fill={top} />
      <circle cx="19" cy="10" r="6.5" fill={skin} />
      <ProfileFace cx={19} cy={10} r={6.5} skin={skin} />
      <path d="M12.5 8 Q19 -0.5 25.5 8 Q25.5 4 19 3 Q12.5 4 12.5 8 Z" fill={dress} />
      <g className="login-scene-arm-load login-scene-arm-load-b">
        <path d="M23 34 Q29 24 24 13" stroke={skin} strokeWidth="4" fill="none" strokeLinecap="round" />
        <g transform="translate(23 10)">
          <ProduceBasket />
        </g>
        <GripFingers x={22.5} y={11} angle={20} skin={skin} />
      </g>
    </g>
  );
}

// Bent forward from the hip (a real rotation, not just a hunched
// shoulder), small tired steps. The short low arm near her torso is the
// one she extends toward the ledger once she arrives.
function StoopedWalker({ skin, top, dress, underDress }) {
  return (
    <>
      <path d="M9 28 L23 28 L26 52 L19 58 L14 58 L6 52 Z" fill={dress} />
      <path d="M12 48 L21 48 L22.5 55 L11.5 55 Z" fill={underDress} opacity="0.9" />
      <ellipse cx="14" cy="57" rx="3.6" ry="1.8" fill="#3D2A1C" />
      <ellipse cx="19" cy="58" rx="3.6" ry="1.8" fill="#3D2A1C" />
      <g transform="rotate(13 16 28)">
        <g className="login-scene-reach-arm login-scene-reach-arm-c">
          <path d="M20 15 Q23 20 19 25" stroke={skin} strokeWidth="3.4" fill="none" strokeLinecap="round" />
        </g>
        <path d="M9 13 L21 13 L23 28 L8 28 Z" fill={top} />
        <path d="M13 13 Q11 9 13 6" stroke={skin} strokeWidth="5" fill="none" strokeLinecap="round" />
        <circle cx="13" cy="6" r="6" fill={skin} />
        <ProfileFace cx={13} cy={6} r={6} skin={skin} />
        <path d="M8 4 Q13 -3 18 4 Q18 1 13 0 Q8 1 8 4 Z" fill={dress} />
        <g className="login-scene-arm-load login-scene-arm-load-c">
          <path d="M9 15 Q6 10 10 4" stroke={skin} strokeWidth="3.4" fill="none" strokeLinecap="round" />
          <g transform="translate(13 -1)">
            <ProduceBasket scale={0.85} />
          </g>
          <GripFingers x={10} y={2} angle={-25} skin={skin} />
        </g>
      </g>
    </>
  );
}

// Broad stance, both arms braced overhead — the counterbalance a
// genuinely heavy head-load forces. Both hands stay on the bundle right
// up to the settle, so she's not one of the two who reaches out either.
function HeavyLoadWalker({ skin, top, dress, underDress }) {
  return (
    <>
      <path d="M14 32 L32 32 L38 70 L8 70 Z" fill={dress} />
      <path d="M18 62 L28 62 L30 68 L16 68 Z" fill={underDress} opacity="0.9" />
      <ellipse cx="14" cy="72" rx="5" ry="2.2" fill="#3D2A1C" />
      <ellipse cx="31" cy="72" rx="5" ry="2.2" fill="#3D2A1C" />
      <rect x="13" y="30" width="20" height="3.4" rx="1.6" fill={underDress} opacity="0.85" />
      <g transform="rotate(-8 23 32)">
        <path d="M12 10 Q23 2 34 10 L36 32 L10 32 Z" fill={top} />
        <circle cx="23" cy="11" r="7.6" fill={skin} />
        <ProfileFace cx={23} cy={11} r={7.6} skin={skin} />
        <path d="M15 9 Q23 -1 31 9 Q31 4 23 3 Q15 4 15 9 Z" fill={dress} />
        <path d="M30 6 L36 10 L30 11 Z" fill={dress} />
        <g className="login-scene-arm-load login-scene-arm-load-d">
          <path d="M13 32 Q6 26 9 15" stroke={skin} strokeWidth="4.6" fill="none" strokeLinecap="round" />
          <path d="M33 32 Q40 26 37 15" stroke={skin} strokeWidth="4.6" fill="none" strokeLinecap="round" />
          <g transform="translate(23 5)">
            <FirewoodBundle scale={1.3} />
          </g>
          <GripFingers x={10} y={13} angle={-30} skin={skin} />
          <GripFingers x={35} y={13} angle={210} skin={skin} />
        </g>
      </g>
    </>
  );
}

function Figure({ id, gait, mirror, reach, scale, walkEnd, w, h, skin, top, dress, underDress, delay }) {
  const Body =
    gait === "limping" ? LimpingWalker : gait === "stooped" ? StoopedWalker : gait === "heavy" ? HeavyLoadWalker : SteadyWalker;
  const ring = RING[id];
  const track = TRACKS[id];
  return (
    <g
      className={`login-scene-figure login-scene-figure-${id}`}
      style={{
        "--login-scene-ring-x": ring.x,
        "--login-scene-ring-y": ring.y,
        "--login-scene-track": `path("${track}")`,
        "--login-scene-walk-end": walkEnd,
        animationDelay: delay,
      }}
    >
      <g
        className={
          "login-scene-figure-scale " +
          (mirror ? "login-scene-figure-scale-mirrored" : "login-scene-figure-scale-plain") +
          (reach ? " login-scene-figure-reaches" : "")
        }
        style={{ "--login-scene-scale": scale, animationDelay: delay }}
      >
        <g className={"login-scene-figure-bounce login-scene-bounce-" + gait} style={{ animationDelay: delay }}>
          <g className="login-scene-figure-turn" style={{ "--login-scene-turn": mirror ? "-9deg" : "9deg" }}>
            <svg
              viewBox={`0 0 ${w} ${h}`}
              width={w}
              height={h}
              x={-w / 2}
              y={-h}
              overflow="visible"
              aria-hidden="true"
            >
              <Body skin={skin} top={top} dress={dress} underDress={underDress} />
            </svg>
          </g>
        </g>
      </g>
    </g>
  );
}

export default function LoginScene() {
  return (
    <div
      className="login-scene"
      role="img"
      aria-label="Illustration of four women from the group walking in at sunset along worn paths toward a shared ledger — one walking steadily with firewood on her head, one limping and leaning on a stick with a basket on her head, one stooped and carrying a basket, one leaning back under a heavier bundle of firewood — settling into a ring around the mat, setting their loads down, and turning in toward the book"
    >
      <svg viewBox="0 0 400 160" className="login-scene-svg" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="login-scene-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F6C15A" />
            <stop offset="45%" stopColor="#EE8C43" />
            <stop offset="100%" stopColor="#DE5F55" />
          </linearGradient>
          <linearGradient id="login-scene-grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9FCE8E" />
            <stop offset="100%" stopColor="#1F5C3B" />
          </linearGradient>
          <radialGradient id="login-scene-sun-glow">
            <stop offset="0%" stopColor="#FFDFA0" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FFDFA0" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="login-scene-lamp-gradient">
            <stop offset="0%" stopColor="#FFDA8A" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#FFDA8A" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="400" height="95" fill="url(#login-scene-sky)" />
        <circle cx="200" cy="97" r="32" fill="url(#login-scene-sun-glow)" />
        <circle cx="200" cy="97" r="14" fill="#FFE1A0" />
        <rect x="0" y="95" width="400" height="65" fill="url(#login-scene-grass)" />

        <path d={TRACKS.a} className="login-scene-track" />
        <path d={TRACKS.b} className="login-scene-track" />
        <path d={TRACKS.c} className="login-scene-track" />
        <path d={TRACKS.d} className="login-scene-track" />

        <g className="login-scene-hearth">
          <ellipse cx={CONVERGENCE.x} cy="118" rx="38" ry="12" fill="#B9924F" stroke="#8C6A2E" strokeWidth="1.4" opacity="0.92" />
          <path d="M168 118 Q200 124 232 118" stroke="#8C6A2E" strokeWidth="1" fill="none" opacity="0.5" />
          <path d="M170 113 Q200 118 230 113" stroke="#8C6A2E" strokeWidth="1" fill="none" opacity="0.4" />
          <g transform={`translate(${CONVERGENCE.x} 109)`}>
            <path d="M0,-4 L-20,-7 L-20,9 L0,12 Z" fill="#FAF7F0" stroke="#D4A94A" strokeWidth="1.3" />
            <path d="M0,-4 L20,-7 L20,9 L0,12 Z" fill="#FAF7F0" stroke="#D4A94A" strokeWidth="1.3" />
            <line x1="0" y1="-4" x2="0" y2="12" stroke="#D4A94A" strokeWidth="1.3" />
          </g>
          {/* Sits low, on the mat beside the ledger, deliberately below the
              head-height band the walkers' faces land in (~y92-100) — a
              lamp up at head height read as floating next to whoever
              settled closest, rather than as an object on the mat. */}
          <g className="login-scene-lamp" transform={`translate(${CONVERGENCE.x + 21} 114)`}>
            <circle r="10" fill="url(#login-scene-lamp-gradient)" className="login-scene-lamp-glow" />
            <rect x="-2" y="0" width="4" height="6" fill="#5C4020" />
            <path d="M-3,0 Q0,-8 3,0 Z" fill="#F5C878" />
          </g>
        </g>

        {FIGURES.map((f, i) => (
          <Figure key={f.id} {...f} delay={`${0.6 + i * 0.05}s`} />
        ))}
      </svg>
    </div>
  );
}
