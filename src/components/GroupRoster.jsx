import React from "react";
import { getGroupRoster } from "../lib/api.js";
import { useApiData } from "../lib/useApiData.js";
import { buildMemberRoster } from "../lib/scheduleUtils.js";

function formatDate(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  if (isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-ZM", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Every member of the group, matched to their scheduled payout date —
 * visible to everyone, not just admins. The payout rotation is the
 * whole trust model of a Chilimba, so being able to see where you (and
 * everyone else) sit in it is the point, not a nice-to-have. See
 * buildMemberRoster in scheduleUtils.js for how names are matched to
 * dates, and getGroupRoster in lib/api/members.js for why this only
 * ever fetches names — never due amounts, balances, or streaks, which
 * stay admin-only (Group Setup's own roster).
 */
export default function GroupRoster({ schedule, currentMemberName }) {
  const { data, loading, error } = useApiData(getGroupRoster, []);

  if (loading && !data) return <p className="muted small">Loading roster…</p>;
  if (error || !data) return null;

  const roster = buildMemberRoster(schedule, data.members.map((m) => m.name));
  if (roster.length === 0) return null;

  return (
    <>
      <h3 className="panel-subtitle">Payout Rotation</h3>
      <p className="muted small" style={{ marginBottom: 10 }}>
        Every member, and when they're scheduled to receive the group's payout.
      </p>
      <div className="feed-list" style={{ marginBottom: 20 }}>
        {roster.map((r) => (
          <div
            className={"feed-item" + (r.name === currentMemberName ? " roster-item-you" : "")}
            key={r.name}
          >
            <span className="feed-name">
              {r.name}
              {r.name === currentMemberName && <span className="tag" style={{ marginLeft: 6 }}>you</span>}
            </span>
            <span className={r.payoutDate ? "muted small" : "muted small roster-unscheduled"}>
              {r.payoutDate ? formatDate(r.payoutDate) : "Not yet scheduled"}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
