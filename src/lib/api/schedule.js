import { MOCK_MODE, lsGet, lsSet, realFetch, currentSession, groupScopedKey } from "./core.js";

// Mirrors createGroup()'s own "Group name is required" check above it in
// auth.js — a group's name can't go empty on a later rename any more than
// it could at creation. The length cap only applies here (not at
// creation) since this is the one place a group name is actually
// re-validated on every save, whatever it was before.
const MAX_GROUP_NAME_LENGTH = 60;

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
  const groupName = (schedule.groupName || "").trim();
  if (!groupName) throw new Error("Enter a group name.");
  if (groupName.length > MAX_GROUP_NAME_LENGTH) {
    throw new Error(`Group name must be ${MAX_GROUP_NAME_LENGTH} characters or fewer.`);
  }
  schedule = { ...schedule, groupName };
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
    const currentPenalty = Number(current?.latePenaltyAmount) || 0;
    const nextPenalty = Number(schedule.latePenaltyAmount) || 0;
    if (nextPenalty > currentPenalty && !subscriptionActiveFor(session)) {
      throw new Error("A late payment penalty is a premium feature — activate your group's subscription first.");
    }
    lsSet(groupScopedKey(session, "group"), schedule);
    return { ok: true };
  }
  return realFetch("/api/schedule", { method: "PUT", body: JSON.stringify(schedule) });
}
