import { MOCK_MODE, lsGet, lsSet, realFetch, currentSession, groupScopedKey } from "./core.js";

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
    lsSet(groupScopedKey(session, "group"), schedule);
    return { ok: true };
  }
  return realFetch("/api/schedule", { method: "PUT", body: JSON.stringify(schedule) });
}
