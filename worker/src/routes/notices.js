import { requireSession, requireAdmin } from "../auth.js";
import { HttpError } from "../httpError.js";
import { uid } from "../crypto.js";
import { json } from "../responses.js";

export default function registerNoticeRoutes(router) {
  // Any member of the group can read notices — this is the whole point,
  // an admin-to-members announcement board. Scoped by group_id from the
  // session, never a client-supplied value. A direct notice
  // (target_member_name set) only shows for the member it's addressed
  // to — except an admin, who sees every notice in their group
  // (broadcast or direct) so they can manage/delete any of them.
  router.get("/api/notices", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);
    const notices = await env.DB.prepare(
      `SELECT id, message, posted_by as postedBy, posted_at as postedAt,
              target_member_name as targetMemberName
       FROM notices
       WHERE group_id = ? AND (? = 1 OR target_member_name IS NULL OR target_member_name = ?)
       ORDER BY posted_at DESC LIMIT 20`
    ).bind(user.groupId, user.role === "admin" ? 1 : 0, user.name).all();
    return json({ notices: notices.results || [] }, 200, cors);
  });

  router.post("/api/notices", async ({ request, env, cors }) => {
    const admin = await requireAdmin(request, env);
    const body = await request.json();
    if (!body.message || !body.message.trim()) throw new HttpError(400, "A message is required.");
    if (body.message.length > 500) throw new HttpError(400, "Keep notices under 500 characters.");

    const targetMemberName = body.targetMemberName && body.targetMemberName.trim() ? body.targetMemberName.trim() : null;

    // Validated in the same statement as the insert (WHERE EXISTS) rather
    // than a separate SELECT beforehand, saving a D1 round trip — the insert
    // simply doesn't happen when targetMemberName is set but isn't a real,
    // active member of the admin's own group (same group-isolation principle
    // as every other group-scoped write in this app, see CLAUDE.md).
    const id = uid();
    const result = await env.DB.prepare(
      `INSERT INTO notices (id, group_id, message, posted_by, target_member_name)
       SELECT ?, ?, ?, ?, ?
       WHERE ? IS NULL OR EXISTS (
         SELECT 1 FROM users WHERE group_id = ? AND active = 1 AND display_name = ?
       )`
    ).bind(
      id, admin.groupId, body.message.trim(), admin.name, targetMemberName,
      targetMemberName, admin.groupId, targetMemberName
    ).run();

    if (targetMemberName && result.meta.changes === 0) {
      throw new HttpError(400, "That member isn't in your group.");
    }

    return json({ id, ok: true }, 201, cors);
  });

  router.del("/api/notices/:id", async ({ request, env, params, cors }) => {
    const admin = await requireAdmin(request, env);
    // Scoped by group_id too — an admin can only delete their own
    // group's notices, never one they happen to guess the id of.
    await env.DB.prepare(`DELETE FROM notices WHERE id = ? AND group_id = ?`)
      .bind(params.id, admin.groupId).run();
    return json({ ok: true }, 200, cors);
  });
}
