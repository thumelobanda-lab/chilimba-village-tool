import { MOCK_MODE, lsGet, lsSet, uid, realFetch, currentSession, groupScopedKey } from "./core.js";

export async function getNotices() {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");
  if (MOCK_MODE) {
    const notices = lsGet(groupScopedKey(session, "notices"), []);
    return { notices: [...notices].sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt)).slice(0, 20) };
  }
  return realFetch("/api/notices");
}

export async function postNotice(message) {
  const session = currentSession();
  if (!session || session.role !== "admin") throw new Error("Admin access required.");
  if (!message || !message.trim()) throw new Error("A message is required.");
  if (message.length > 500) throw new Error("Keep notices under 500 characters.");

  if (MOCK_MODE) {
    const key = groupScopedKey(session, "notices");
    const notices = lsGet(key, []);
    const notice = { id: uid(), message: message.trim(), postedBy: session.name, postedAt: new Date().toISOString() };
    lsSet(key, [...notices, notice]);
    return { id: notice.id, ok: true };
  }

  return realFetch("/api/notices", { method: "POST", body: JSON.stringify({ message }) });
}

export async function deleteNotice(id) {
  const session = currentSession();
  if (!session || session.role !== "admin") throw new Error("Admin access required.");

  if (MOCK_MODE) {
    const key = groupScopedKey(session, "notices");
    const notices = lsGet(key, []);
    lsSet(key, notices.filter((n) => n.id !== id));
    return { ok: true };
  }

  return realFetch(`/api/notices/${id}`, { method: "DELETE" });
}
