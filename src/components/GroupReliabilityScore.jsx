import React from "react";

/**
 * The group-wide reliability score (GRS) — a single percentage, visible
 * to every member and the admin alike, no per-member breakdown (see
 * worker/src/reliability.js for the weighting: on-time=100%,
 * late=50%, missed=0%, averaged across every past due date). `grs` is
 * whatever GET /api/dashboard/pulse returns under its `grs` key:
 * {score: number|null, sampleSize: number} — null means not enough
 * payment history yet to produce a meaningful score.
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

  const tone = grs.score >= 80 ? "grs-good" : grs.score >= 50 ? "grs-ok" : "grs-low";

  return (
    <div className="grs-strip">
      <strong>Group Reliability Score:</strong>{" "}
      <span className={tone}>{grs.score}%</span>
      <span className="muted tiny"> — how often the group pays on time, based on {grs.sampleSize} past due dates</span>
    </div>
  );
}
