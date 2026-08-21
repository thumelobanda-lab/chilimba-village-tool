import { MOCK_MODE, lsGet, lsSet, realFetch, currentSession, groupScopedKey } from "./core.js";

function subscriptionActiveFor(session) {
  const sub = lsGet(groupScopedKey(session, "group-sub"), null);
  return !!(sub?.expiresAt && new Date(sub.expiresAt).getTime() > Date.now());
}

// Requires a session in both modes now — with multiple groups there's no
// way to know whose schedule to return without knowing who's asking
// first. The real backend derives the group from the session server-side
// (see worker/src/routes/schedule.js); mock mode reads it from the
// session's groupSlug the same way.
export async function getSchedule() {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");
  if (MOCK_MODE) return lsGet(groupScopedKey(session, "group"), null);
  return realFetch("/api/schedule");
}

export async function saveSchedule(schedule) {
  const session = currentSession();
  if (!session || session.role !== "admin") {
    throw new Error("Only a group admin can edit the schedule.");
  }
  if (MOCK_MODE) {
    // Only blocks actually raising the rate above what's already saved —
    // mirrors worker/src/routes/schedule.js's PUT handler, so a group
    // that lapses from premium back to free doesn't find every OTHER
    // Group Setup save blocked by a stale carried-forward value it can't
    // even edit anymore.
    const current = lsGet(groupScopedKey(session, "group"), null);
    const currentDeduction = Number(current?.communityFundDeduction) || 0;
    const nextDeduction = Number(schedule.communityFundDeduction) || 0;
    if (nextDeduction > currentDeduction && !subscriptionActiveFor(session)) {
      throw new Error("Automatic community fund splitting is a premium feature — activate your group's subscription first.");
    }
    lsSet(groupScopedKey(session, "group"), schedule);
    return { ok: true };
  }
  return realFetch("/api/schedule", { method: "PUT", body: JSON.stringify(schedule) });
}
