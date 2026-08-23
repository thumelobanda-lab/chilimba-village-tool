import React from "react";
import { money } from "./LedgerTable.jsx";
import { useCountUp } from "../hooks/useCountUp.js";

/**
 * The group-wide layer of the dashboard — deliberately aggregate-only
 * (see getGroupPulse in lib/api/dashboard.js): a total, and a count of
 * how many members have paid recently, never who specifically. A single
 * slim strip, not a card — this is a nice-to-know, not the number
 * someone opens the app to check.
 */
export default function GroupPulse({ data, loading }) {
  // Called unconditionally (hooks can't be conditional) — before data
  // arrives this just counts up to 0, a no-op; once it's in, useCountUp
  // reveals it the same way the primary balance figure does, and keeps
  // counting from wherever it's sitting (not resetting to 0) if the
  // total changes again later in the same session.
  const totalDisplay = useCountUp(data?.totalContributed ?? 0);

  if (loading) return <p className="muted small" aria-live="polite">Loading group activity…</p>;
  if (!data) return <p className="muted small">Group activity isn't available right now.</p>;

  return (
    <div className="group-pulse-strip">
      👥 <strong>{money(totalDisplay)}</strong> contributed this round · <strong>{data.membersPaidThisWeek}</strong> of {data.totalActiveMembers} members paid this week
    </div>
  );
}
