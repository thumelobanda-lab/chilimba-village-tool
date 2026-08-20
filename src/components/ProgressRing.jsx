import React, { useEffect, useState } from "react";

/**
 * SVG "how far through the cycle" ring for the home dashboard. Animates
 * from empty to `percent` on mount purely via a CSS transition on
 * stroke-dashoffset (see .progress-ring-arc in styles.css) — that
 * transition is itself disabled under prefers-reduced-motion, so there's
 * no separate JS motion check needed here.
 */
export default function ProgressRing({ percent, size = 96, strokeWidth = 8, sublabel }) {
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
    <div className="progress-ring-wrap">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Cycle progress: ${Math.round(clamped)}%`}
      >
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--line)" strokeWidth={strokeWidth} />
        <circle
          className="progress-ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent-2)"
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
