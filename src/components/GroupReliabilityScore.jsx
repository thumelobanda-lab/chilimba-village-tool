import React from "react";
import { grsTone } from "../lib/reliability.js";

/**
 * The group-wide reliability score (GRS) — a single percentage, visible
 * to every member and the admin alike, no per-member breakdown (see
 * worker/src/reliability.js for the weighting: on-time=100%,
 * late=50%, missed=0%, averaged across every past due date). `grs` is
 * whatever GET /api/dashboard/pulse returns under its `grs` key:
 * {score: number|null, sampleSize: number} — null means not enough
 * payment history yet to produce a meaningful score.
 *
 * Gold/red only, no green — the dashboard theme reserves green for its
 * own single highlight (the contribution figure), so grsTone()'s "good"
 * band is folded into "ok" (gold) here too, "low" stays red.
 */
export default function GroupReliabilityScore({ grs }) {
  if (!grs) return null;

  if (grs.score == null) {
    return (
      <div className="grs-strip">
        <strong>Group Reliability Score:</strong> not enough payment history yet
      </div>
    );
  }

  const tone = `grs-${grsTone(grs.score) === "low" ? "low" : "ok"}`;

  return (
    <div className="grs-strip">
      <strong>Group Reliability Score:</strong>{" "}
      <span className={tone}>{grs.score}%</span>
      <span className="muted tiny"> — how often the group pays on time, based on {grs.sampleSize} past due dates</span>
    </div>
  );
}
