import { requireSession } from "../auth.js";
import { HttpError } from "../httpError.js";
import { json } from "../responses.js";

/**
 * A signed-in member/admin's own inbox for platform-owner direct
 * messages (migration 010) — entirely read/write via requireSession,
 * never requireOwner. Every query below is scoped by
 * `user_id = user.id` (the caller's own id from their session), never a
 * client-supplied id, so there is no way — admin or not — to read or
 * dismiss a message addressed to someone else. Nothing here can CREATE a
 * message; that's exclusively POST /api/owner/messages under
 * requireOwner (see routes/owner.js) — this file only ever reads or
 * marks-read rows that route already inserted.
 */
export default function registerMessageRoutes(router) {
  // Unread only — this is a one-time "you have a message" banner (see
  // PlatformMessageBanner.jsx), not a persistent feed like notices.js;
  // once dismissed (POST below) it never comes back.
  router.get("/api/messages", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);
    const result = await env.DB.prepare(
      `SELECT omr.id as recipientId, om.message, om.sent_at as sentAt
       FROM owner_message_recipients omr JOIN owner_messages om ON om.id = omr.message_id
       WHERE omr.user_id = ? AND omr.read_at IS NULL
       ORDER BY om.sent_at DESC`
    ).bind(user.id).all();
    return json({ messages: result.results || [] }, 200, cors);
  });

  router.post("/api/messages/:id/read", async ({ request, env, params, cors }) => {
    const user = await requireSession(request, env);
    const owned = await env.DB.prepare(
      `SELECT id FROM owner_message_recipients WHERE id = ? AND user_id = ?`
    ).bind(params.id, user.id).first();
    if (!owned) throw new HttpError(404, "Message not found.");

    await env.DB.prepare(`UPDATE owner_message_recipients SET read_at = datetime('now') WHERE id = ?`)
      .bind(params.id).run();
    return json({ ok: true }, 200, cors);
  });
}
