import React from "react";

// Purely decorative — every value here is a static layout constant, no
// state, no data fetching, nothing that needs a hook.
//
// Four women converge on a shared ledger at sunset. Each walks in along
// her own worn path (see TRACKS below) toward the mat/ledger/lamp at the
// convergence point, then sits down in a ring around it, load set on the
// grass beside her, facing in. The whole thing is one SVG document (not
// HTML divs over a background image) so every figure's `offset-path` can
// share the exact same coordinate space — and the exact same `d` string
// — as the visible track it walks along; drawn path and walking path can
// never diverge because they're the same string, not two hand-tuned
// copies of the same curve.
//
// Colors here are hardcoded, not theme tokens — this is a sunset/emerald
// illustration, not chrome; it must look identical in light and dark
// mode (the rest of the app inverts for dark mode, this deliberately
// doesn't).
//
// Depth cues (all static, no animation involved):
//   - each figure's dress/top is a light-to-dark gradient, sun-facing
//     side lighter — see the per-figure <linearGradient>s built from
//     FIGURES in the main <svg>'s <defs>, oriented so local +x (every
//     walker is drawn facing that way) always lands on the light stop.
//   - a soft contact shadow sits under each figure, elongated toward the
//     viewer (away from the low sun behind the mat) and fading with
//     distance from her feet.
//   - the two outer figures (a, d — the ones on longer, wider tracks)
//     paint first and use a slightly cooler, less saturated palette; the
//     two inner ones (b, c) paint after (so they visually sit in front
//     where the ring gets close) and keep the fuller warm tones —
//     see RENDER_ORDER and each figure's colors in FIGURES.
//
// Timeline (see styles.css's `.login-scene-*` rules for the actual
// keyframes — this comment is the map):
//   0.0–0.6s  scene (sky/ground/paths/mat/ledger) is simply visible;
//             only the lamp's glow fades up, establishing the
//             destination before anyone arrives.
//   0.6–2.6s  all four women enter at once, each riding her own track
//             via `offset-path`/`offset-distance` (100% → ~walkEnd),
//             scaling 0.28 → her own resting scale and fading 0.5 → 1 as
//             they approach, with a small per-gait walking bob layered
//             on top via a separate nested element (two CSS animations
//             can't both drive `transform` on the same element without
//             one clobbering the other) — she's drawn standing/walking
//             (see the *Walker components) this whole phase.
//   2.6–3.5s  each one turns slightly inward and crossfades from her
//             standing pose to a seated one (.login-scene-pose-standing
//             opacity 1→0, .login-scene-pose-seated 0→1) — legs folded,
//             load already set down beside her in the new pose, so the
//             "sit down and set the load on the grass" motion reads as
//             one settle rather than a separate limb animation on top of
//             the standing figure. Everything holds at 3.5s — no
//             looping — since that seated ring is the frame most users
//             actually sit and look at.
//
// `prefers-reduced-motion: reduce` (or a browser with no support for
// `offset-path`) never sees any of the above: the default/unqualified
// CSS below places every figure directly at her settled ring position,
// already seated, load already down, facing in — .login-scene-pose-seated
// is the only one visible, .login-scene-pose-standing stays at opacity 0.
// The entrance/settle animations are added *only* inside
// `@media (prefers-reduced-motion: no-preference)`, same pattern the
// rest of this scene already used.

// Simple hex lighten/darken — mixes toward white (amt > 0) or black
// (amt < 0). Used to derive each figure's sun-facing/shadow-side
// gradient stops from her one base dress/top color, rather than hand-
// picking eight extra hex values that would drift out of sync with them.
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c) => Math.max(0, Math.min(255, Math.round(amt > 0 ? c + (255 - c) * amt : c + c * amt)));
  return `#${((1 << 24) + (mix(r) << 16) + (mix(g) << 8) + mix(b)).toString(16).slice(1)}`;
}

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
// need to read as "a ring of women sitting around the mat," clear of
// the ledger and evenly spaced.
const RING = {
  a: { x: 120, y: 126 },
  b: { x: 158, y: 128 },
  c: { x: 242, y: 128 },
  d: { x: 280, y: 126 },
};

// Paint order, not data order: the two inner figures (b, c) are drawn
// after — on top of — the two outer ones (a, d), so where the seated
// ring gets close together the nearer pair visibly overlaps the further
// pair instead of a random/data-order z-fight. See the RENDER_ORDER map
// at the bottom of this file.
const RENDER_ORDER = ["a", "d", "b", "c"];

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
    headR: 7,
    loadType: "firewood",
    // Outer track, paints first — the slightly cooler/desaturated pair,
    // see the module doc comment's "Depth cues" section.
    skin: "#6E5240",
    top: "#A97A52",
    dress: "#C7B27C",
    underDress: "#83704E",
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
    headR: 6.5,
    loadType: "basket",
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
    headR: 6,
    loadType: "basket",
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
    headR: 7.6,
    loadType: "firewood",
    // Outer track, paints first — cooler/desaturated, same as `a`.
    skin: "#4F3E34",
    top: "#6E5C4E",
    dress: "#7C7256",
    underDress: "#584A40",
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

// Bound sticks, not a flat bundle silhouette: each stick gets a thin
// lighter highlight along its top edge (a rounded log catching the
// light) and the whole bundle sits on a soft ground shadow so it reads
// as resting weight, not a sticker.
function FirewoodBundle({ scale = 1 }) {
  return (
    <g transform={`scale(${scale})`}>
      <ellipse cx="0" cy="7" rx="12" ry="2.4" fill="#12281c" opacity="0.22" />
      <line x1="-11" y1="2" x2="11" y2="-3" stroke="#6B4423" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="-11" y1="2" x2="11" y2="-3" stroke="#A9793F" strokeWidth="0.9" strokeLinecap="round" transform="translate(0 -0.6)" />
      <line x1="-11" y1="-1" x2="11" y2="1" stroke="#7A5C1E" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="-11" y1="-1" x2="11" y2="1" stroke="#B89347" strokeWidth="0.9" strokeLinecap="round" transform="translate(0 -0.6)" />
      <line x1="-11" y1="-4" x2="11" y2="-1" stroke="#6B4423" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="-11" y1="-4" x2="11" y2="-1" stroke="#A9793F" strokeWidth="0.9" strokeLinecap="round" transform="translate(0 -0.6)" />
      <line x1="-9" y1="4.5" x2="9" y2="-5.5" stroke="#4A2F16" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      <line x1="0" y1="-6" x2="0" y2="5" stroke="#3E2E0E" strokeWidth="1.6" />
    </g>
  );
}

// A woven curve, not a flat oval: the fill is the shared radial
// gradient (light upper-left, darker lower-right rim — see
// login-scene-basket-gradient in the main <svg>'s <defs>), plus a dark
// arc along the lower rim for the underside of the weave and a matching
// ground shadow.
function ProduceBasket({ scale = 1 }) {
  return (
    <g transform={`scale(${scale})`}>
      <ellipse cx="0" cy="7.5" rx="10" ry="2.4" fill="#12281c" opacity="0.22" />
      <ellipse cx="0" cy="0" rx="9" ry="6.2" fill="url(#login-scene-basket-gradient)" stroke="#6E4A12" strokeWidth="1" />
      <path d="M-7.6,2.6 A9,6.2 0 0 0 7.6,2.6" stroke="#5C3E0E" strokeWidth="1.1" fill="none" opacity="0.55" />
      <circle cx="-3" cy="-3" r="2.1" fill="#B23B2A" />
      <circle cx="2.5" cy="-4" r="1.9" fill="#3F6B2E" />
      <circle cx="-0.5" cy="-1.5" r="1.7" fill="#D4A94A" />
    </g>
  );
}

// Upright, even stride, firewood on the head — the confident baseline
// gait the other three read as departures from. Her free arm (hanging
// at her side while she walks) is the one that reaches for the ledger
// once she sits.
function SteadyWalker({ id, skin, dress, underDress }) {
  return (
    <>
      <path d="M25 34 Q31 39 28 47" stroke={skin} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M12 30 L28 30 L33 62 L22 70 L18 70 L7 62 Z" fill={`url(#login-scene-grad-dress-${id})`} />
      <path d="M16 58 L26 58 L28 66 L14 66 Z" fill={underDress} opacity="0.9" />
      <path d="M17 60 L22 60 L20 70 L18 70 Z" fill={skin} />
      <ellipse cx="19" cy="72" rx="4" ry="2" fill="#3D2A1C" />
      <ellipse cx="9" cy="65" rx="3.2" ry="1.8" fill="#3D2A1C" />
      <rect x="12" y="28" width="16" height="3" rx="1.5" fill={underDress} opacity="0.85" />
      <path d="M14 12 Q20 6 26 12 L28 30 L12 30 Z" fill={`url(#login-scene-grad-top-${id})`} />
      <circle cx="20" cy="10" r="7" fill={skin} />
      <ProfileFace cx={20} cy={10} r={7} skin={skin} />
      <path d="M13 8 Q20 -1 27 8 Q27 4 20 3 Q13 4 13 8 Z" fill={dress} />
      <path d="M26 6 L31 9 L26 10 Z" fill={dress} />
      <g>
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
function LimpingWalker({ id, skin, dress, underDress }) {
  return (
    <g transform="rotate(6 19 30)">
      <line x1="9" y1="46" x2="6" y2="68" stroke="#5C4020" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="9" cy="45" r="1.8" fill="#5C4020" />
      <path d="M13 34 Q7 39 9 46" stroke={skin} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M11 30 L27 30 L30 56 L22 63 L15 66 L8 55 Z" fill={`url(#login-scene-grad-dress-${id})`} />
      <path d="M14 54 L23 54 L24 61 L15 62 Z" fill={underDress} opacity="0.9" />
      <ellipse cx="13" cy="65" rx="4" ry="2" fill="#3D2A1C" />
      <ellipse cx="24" cy="59" rx="3" ry="1.6" fill="#3D2A1C" transform="rotate(18 24 59)" />
      <path d="M13 12 Q19 6 25 12 L27 30 L11 30 Z" fill={`url(#login-scene-grad-top-${id})`} />
      <circle cx="19" cy="10" r="6.5" fill={skin} />
      <ProfileFace cx={19} cy={10} r={6.5} skin={skin} />
      <path d="M12.5 8 Q19 -0.5 25.5 8 Q25.5 4 19 3 Q12.5 4 12.5 8 Z" fill={dress} />
      <g>
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
// one she extends toward the ledger once she sits.
function StoopedWalker({ id, skin, dress, underDress }) {
  return (
    <>
      <path d="M9 28 L23 28 L26 52 L19 58 L14 58 L6 52 Z" fill={`url(#login-scene-grad-dress-${id})`} />
      <path d="M12 48 L21 48 L22.5 55 L11.5 55 Z" fill={underDress} opacity="0.9" />
      <ellipse cx="14" cy="57" rx="3.6" ry="1.8" fill="#3D2A1C" />
      <ellipse cx="19" cy="58" rx="3.6" ry="1.8" fill="#3D2A1C" />
      <g transform="rotate(13 16 28)">
        <path d="M20 15 Q23 20 19 25" stroke={skin} strokeWidth="3.4" fill="none" strokeLinecap="round" />
        <path d="M9 13 L21 13 L23 28 L8 28 Z" fill={`url(#login-scene-grad-top-${id})`} />
        <path d="M13 13 Q11 9 13 6" stroke={skin} strokeWidth="5" fill="none" strokeLinecap="round" />
        <circle cx="13" cy="6" r="6" fill={skin} />
        <ProfileFace cx={13} cy={6} r={6} skin={skin} />
        <path d="M8 4 Q13 -3 18 4 Q18 1 13 0 Q8 1 8 4 Z" fill={dress} />
        <g>
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
function HeavyLoadWalker({ id, skin, dress, underDress }) {
  return (
    <>
      <path d="M14 32 L32 32 L38 70 L8 70 Z" fill={`url(#login-scene-grad-dress-${id})`} />
      <path d="M18 62 L28 62 L30 68 L16 68 Z" fill={underDress} opacity="0.9" />
      <ellipse cx="14" cy="72" rx="5" ry="2.2" fill="#3D2A1C" />
      <ellipse cx="31" cy="72" rx="5" ry="2.2" fill="#3D2A1C" />
      <rect x="13" y="30" width="20" height="3.4" rx="1.6" fill={underDress} opacity="0.85" />
      <g transform="rotate(-8 23 32)">
        <path d="M12 10 Q23 2 34 10 L36 32 L10 32 Z" fill={`url(#login-scene-grad-top-${id})`} />
        <circle cx="23" cy="11" r="7.6" fill={skin} />
        <ProfileFace cx={23} cy={11} r={7.6} skin={skin} />
        <path d="M15 9 Q23 -1 31 9 Q31 4 23 3 Q15 4 15 9 Z" fill={dress} />
        <path d="M30 6 L36 10 L30 11 Z" fill={dress} />
        <g>
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

// The final, held pose — legs folded and puddled wide on the ground
// (not the walking silhouette shrunk down), load already set beside her
// rather than on her head, one relaxed arm and, for the two `reach`
// figures, a second arm extended toward the ledger. Shared across all
// four rather than one bespoke seated drawing per gait: standing/
// walking needed distinct gaits to read as different people in motion,
// but "sitting cross-legged, shoulders relaxed" doesn't vary the same
// way, and headR/scale/color/load already carry each figure's identity
// through into this pose.
function SeatedFigure({ id, skin, dress, underDress, headR, reach, loadType }) {
  const hx = 23;
  const hy = headR + 2;
  return (
    <>
      <g transform="translate(6 34)">{loadType === "firewood" ? <FirewoodBundle /> : <ProduceBasket />}</g>
      <path
        d="M15,20 L31,20 Q42,26 40,36 Q23,40 6,36 Q4,26 15,20 Z"
        fill={`url(#login-scene-grad-dress-${id})`}
      />
      <ellipse cx="16" cy="22.5" rx="4.5" ry="2.4" fill={underDress} opacity="0.4" />
      <ellipse cx="30" cy="22.5" rx="4.5" ry="2.4" fill={underDress} opacity="0.4" />
      {!reach && <path d="M16 12 Q10 17 13 23" stroke={skin} strokeWidth="3.6" fill="none" strokeLinecap="round" />}
      <path d="M14 6 L32 6 L34 20 L12 20 Z" fill={`url(#login-scene-grad-top-${id})`} />
      <circle cx={hx} cy={hy} r={headR} fill={skin} />
      <ProfileFace cx={hx} cy={hy} r={headR} skin={skin} />
      <path
        d={`M${hx - headR * 0.72},${hy - headR * 0.55} Q${hx},${hy - headR * 1.55} ${hx + headR * 0.72},${
          hy - headR * 0.55
        } Q${hx + headR * 0.72},${hy - headR * 1.05} ${hx},${hy - headR * 1.15} Q${hx - headR * 0.72},${
          hy - headR * 1.05
        } ${hx - headR * 0.72},${hy - headR * 0.55} Z`}
        fill={dress}
      />
      {reach && (
        <g>
          <path d="M31 12 Q40 15 45 19" stroke={skin} strokeWidth="3.6" fill="none" strokeLinecap="round" />
          <GripFingers x={44} y={17.5} angle={35} skin={skin} />
        </g>
      )}
    </>
  );
}

function Figure({ id, gait, mirror, reach, scale, walkEnd, w, h, headR, loadType, skin, dress, underDress, delay }) {
  const StandingBody =
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
        className={"login-scene-figure-scale " + (mirror ? "login-scene-figure-scale-mirrored" : "login-scene-figure-scale-plain")}
        style={{ "--login-scene-scale": scale, animationDelay: delay }}
      >
        {/* Sibling of the bounce/turn chain below, not a descendant — a
            contact shadow shouldn't inherit the walking bob or the
            settle-phase inward lean, it just sits on the ground under
            whichever pose is currently visible and grows/shrinks with
            her approach. */}
        <ellipse className="login-scene-figure-shadow" cx="0" cy="2" rx="15" ry="5" />
        <g className={"login-scene-figure-bounce login-scene-bounce-" + gait} style={{ animationDelay: delay }}>
          <g className="login-scene-figure-turn" style={{ "--login-scene-turn": mirror ? "-9deg" : "9deg" }}>
            <g className="login-scene-pose-standing">
              <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} x={-w / 2} y={-h} overflow="visible" aria-hidden="true">
                <StandingBody id={id} skin={skin} dress={dress} underDress={underDress} />
              </svg>
            </g>
            <g className="login-scene-pose-seated">
              <svg viewBox="0 0 46 40" width="46" height="40" x="-23" y="-40" overflow="visible" aria-hidden="true">
                <SeatedFigure id={id} skin={skin} dress={dress} underDress={underDress} headR={headR} reach={reach} loadType={loadType} />
              </svg>
            </g>
          </g>
        </g>
      </g>
    </g>
  );
}

export default function LoginScene() {
  const byId = Object.fromEntries(FIGURES.map((f) => [f.id, f]));
  return (
    <div
      className="login-scene"
      role="img"
      aria-label="Illustration of four women from the group walking in at sunset along worn paths toward a shared ledger — one walking steadily with firewood on her head, one limping and leaning on a stick with a basket on her head, one stooped and carrying a basket, one leaning back under a heavier bundle of firewood — then sitting down in a ring around the mat, loads set on the grass beside them, facing in toward the book"
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
          {/* Shared by every FirewoodBundle/ProduceBasket instance — a
              woven basket's curve reads the same regardless of which
              figure is carrying it, so one radial gradient covers all of
              them rather than needing a per-figure copy the way the
              dress/top ones below do (those vary by figure color). */}
          <radialGradient id="login-scene-basket-gradient" cx="35%" cy="30%">
            <stop offset="0%" stopColor="#E0C08C" />
            <stop offset="100%" stopColor="#9E7A3E" />
          </radialGradient>
          {/* Every figure's ground contact shadow (see
              .login-scene-figure-shadow in styles.css) references this —
              dark near her feet, fading to nothing at the ellipse's own
              edge instead of a hard-edged shape. */}
          <radialGradient id="login-scene-shadow-gradient">
            <stop offset="0%" stopColor="#0E2417" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0E2417" stopOpacity="0" />
          </radialGradient>
          {/* One light-to-dark gradient per figure per garment (dress,
              top) — local +x is every walker's "front"/sun-facing side
              (see the module doc comment), so x2 always gets the
              lightened stop and x1 the darkened one, for both the
              standing and seated poses (both reference the same id). */}
          {FIGURES.map((f) => (
            <React.Fragment key={f.id}>
              <linearGradient id={`login-scene-grad-dress-${f.id}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor={shade(f.dress, -0.22)} />
                <stop offset="1" stopColor={shade(f.dress, 0.16)} />
              </linearGradient>
              <linearGradient id={`login-scene-grad-top-${f.id}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor={shade(f.top, -0.22)} />
                <stop offset="1" stopColor={shade(f.top, 0.16)} />
              </linearGradient>
            </React.Fragment>
          ))}
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

        {RENDER_ORDER.map((id, i) => (
          <Figure key={id} {...byId[id]} delay={`${0.6 + i * 0.05}s`} />
        ))}
      </svg>
    </div>
  );
}
