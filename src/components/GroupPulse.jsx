import React from "react";
import { money } from "./LedgerTable.jsx";
import { useCountUp } from "../hooks/useCountUp.js";

/**
 * The group-wide layer of the dashboard — deliberately aggregate-only
 * (see getGroupPulse in lib/api/dashboard.js): a total, and a count of
 * how many members have paid recently, never who specifically. Loading
 * state mirrors the Community Fund Total card on the same dashboard —
 * async, non-blocking, doesn't hold up anything else from rendering.
 */
export default function GroupPulse({ data, loading }) {
  // Called unconditionally (hooks can't be conditional) — before data
  // arrives this just counts up to 0, a no-op; once it's in, useCountUp
  // reveals it the same way the other vital-card figures do, and keeps
  // counting from wherever it's sitting (not resetting to 0) if the
  // total changes again later in the same session.
  const totalDisplay = useCountUp(data?.totalContributed ?? 0);

  return (
    <div className="panel group-pulse-panel">
      <div className="vital-card-label">Group Pulse</div>

      {loading ? (
        <p className="muted small" aria-live="polite">Loading…</p>
      ) : data ? (
        <>
          <div className="group-pulse-total">{money(totalDisplay)}</div>
          <p className="muted small" style={{ margin: "2px 0 10px" }}>contributed this cycle</p>
          <p className="group-pulse-activity">
            👥 <strong>{data.membersPaidThisWeek}</strong> of {data.totalActiveMembers} members have paid this week
          </p>
        </>
      ) : (
        <p className="muted small">Group activity isn't available right now.</p>
      )}
    </div>
  );
}
