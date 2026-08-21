import { MOCK_MODE, realFetch } from "./core.js";

/**
 * A signed-in member/admin's own inbox for platform-owner direct
 * messages (see worker/src/routes/messages.js) — deliberately distinct
 * from notices.js (an admin's own announcement to their own group).
 * There's no mock-mode data source for these: only a real owner account
 * (src/lib/api/owner.js, which itself has no mock branch — see that
 * file's own comment) can ever create one, so mock mode always reads an
 * empty inbox rather than faking one.
 */
export async function getMyMessages() {
  if (MOCK_MODE) return { messages: [] };
  return realFetch("/api/messages");
}

export async function markMessageRead(recipientId) {
  if (MOCK_MODE) return { ok: true };
  return realFetch(`/api/messages/${recipientId}/read`, { method: "POST" });
}
