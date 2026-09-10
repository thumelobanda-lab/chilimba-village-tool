import { MOCK_MODE, lsGet, lsSet, realFetch, currentSession, groupScopedKey } from "./core.js";

const MAX_LENGTH = 5000;

// A member's own private scratchpad — one plain-text field, not a list
// of titled notes. Always acts on the signed-in session, same as
// Profile.jsx's updateProfile: there's no name parameter to pass in, so
// nobody can read or write anyone else's notepad by construction.
export async function getNotepad() {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");

  if (MOCK_MODE) {
    const text = lsGet(groupScopedKey(session, "notepad", session.name.toLowerCase()), "");
    return { text };
  }

  return realFetch("/api/notepad");
}

export async function saveNotepad(text) {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");
  if ((text || "").length > MAX_LENGTH) throw new Error(`Keep notes under ${MAX_LENGTH.toLocaleString()} characters.`);

  if (MOCK_MODE) {
    lsSet(groupScopedKey(session, "notepad", session.name.toLowerCase()), text || "");
    return { ok: true };
  }

  return realFetch("/api/notepad", { method: "PUT", body: JSON.stringify({ text }) });
}
