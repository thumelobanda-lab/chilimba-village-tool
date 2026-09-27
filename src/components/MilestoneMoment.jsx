import React, { useEffect, useState } from "react";
import { payeesLabel } from "../lib/scheduleUtils.js";
import { pickMilestoneImage, hasSeenMilestone, markMilestoneSeen } from "../lib/milestones.js";

/**
 * A brief, dignified "payout day" celebration — one of four self-hosted
 * photos (public/images/milestones/) picked at random, shown once for a
 * genuine cycle-completion/payout event (see resolveMilestoneEvent in
 * lib/milestones.js) and never again after that. Sits alongside
 * PayoutAcknowledgment.jsx's plainer text banner rather than replacing
 * it — this is the once-per-event moment, that one's the quieter
 * "still within the window" reminder.
 *
 * Marked seen the instant this actually renders (not only on explicit
 * dismiss) so navigating away without tapping "Dismiss" still counts —
 * same one-time guarantee, without needing the member to close it.
 */
export default function MilestoneMoment({ groupSlug, event }) {
  const { row, cycleComplete } = event;
  const [dismissed, setDismissed] = useState(() => hasSeenMilestone(groupSlug, row.id));
  const [image] = useState(pickMilestoneImage);

  useEffect(() => {
    markMilestoneSeen(groupSlug, row.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (dismissed) return null;

  const line = cycleComplete
    ? `Cycle complete — payout sent to ${payeesLabel(row)}.`
    : `Payout sent to ${payeesLabel(row)}.`;

  return (
    <div className="milestone-card">
      <img
        className="hero-banner-img"
        src={`/images/milestones/${image.file}`}
        width={image.width}
        height={image.height}
        loading="lazy"
        alt={image.alt}
      />
      <div className="milestone-card-overlay">
        <span className="milestone-card-caption">{line}</span>
      </div>
      <button
        type="button"
        className="milestone-card-dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
