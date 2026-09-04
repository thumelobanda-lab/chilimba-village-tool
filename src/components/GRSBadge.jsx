import React from "react";
import { grsTone } from "../lib/reliability.js";

/**
 * Compact color-coded Group Reliability Score pill for the dashboard
 * hero, next to the group name — GroupReliabilityScore.jsx's full strip
 * (Community tab) is the "what does this mean" explainer; this is just
 * the number, at a glance. Same null/insufficient-history handling: no
 * badge at all rather than a misleading placeholder.
 *
 * Deliberately gold/red only, never green — the dashboard theme reserves
 * green for a single highlight (the contributed-amount figure), so
 * grsTone()'s "good" band is folded into the same gold styling as "ok"
 * here; only "low" gets its own (red) treatment.
 */
export default function GRSBadge({ grs }) {
  if (!grs || grs.score == null) return null;

  const tone = grsTone(grs.score) === "low" ? "low" : "ok";

  return (
    <span
      className={`grs-badge grs-badge-${tone}`}
      title={`Group Reliability Score — how often the group pays on time, based on ${grs.sampleSize} past due dates`}
    >
      GRS {grs.score}%
    </span>
  );
}
