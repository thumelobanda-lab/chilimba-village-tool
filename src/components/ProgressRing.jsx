import React, { useEffect, useState } from "react";

/**
 * SVG "how far through the cycle" ring for the home dashboard. Animates
 * from empty to `percent` on mount, and — since the CSS transition on
 * stroke-dashoffset animates from whatever the arc's current position
 * is, not from a fixed start — fills smoothly toward a new value too, if
 * `percent` changes while this stays mounted (see .progress-ring-arc in
 * styles.css). That transition is itself disabled under
 * prefers-reduced-motion, so there's no separate JS motion check needed
 * here.
 *
 * `glow` adds a golden luminous highlight around the arc — reserved for
 * moments actually worth the viewer's attention (their payout turn is
 * close, the cycle's nearly done, or someone was just paid out; see
 * Dashboard.jsx), so it stays off otherwise and means something when it
 * lights up.
 *
 * `arcColor` overrides the arc's stroke (default the theme's ordinary
 * --accent) — the dashboard's hero placement uses gold instead, so the
 * ring reads as the one centerpiece metric rather than matching the
 * plain green everything else on the card already uses. `filled` adds a
 * soft translucent gold disc behind the ring for that same hero
 * placement, giving it more visual weight than the plain stroke-only
 * ring everywhere else.
 */
export default function ProgressRing({
  percent,
  size = 96,
  strokeWidth = 8,
  sublabel,
  glow = false,
  arcColor = "var(--accent)",
  filled = false,
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (clamped / 100) * circumference;

  // Starts at "empty" (offset = full circumference) and is nudged to the
  // real offset one frame after mount, so the CSS transition has a
  // start-state to animate from rather than snapping straight to it.
  const [offset, setOffset] = useState(circumference);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOffset(targetOffset));
    return () => cancelAnimationFrame(raf);
  }, [targetOffset]);

  return (
    <div
      className={"progress-ring-wrap" + (glow ? " progress-ring-glow" : "") + (filled ? " progress-ring-filled" : "")}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Round progress: ${Math.round(clamped)}%`}
      >
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--line)" strokeWidth={strokeWidth} />
        <circle
          className="progress-ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={arcColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="progress-ring-center">
        <div className="progress-ring-percent">{Math.round(clamped)}%</div>
      </div>
      {sublabel && <div className="progress-ring-sublabel muted tiny">{sublabel}</div>}
    </div>
  );
}
