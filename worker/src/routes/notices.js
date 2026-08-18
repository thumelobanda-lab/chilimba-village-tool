import { requireSession, requireAdmin } from "../auth.js";
import { HttpError } from "../httpError.js";
import { uid } from "../crypto.js";
import { json } from "../responses.js";

export default function registerNoticeRoutes(router) {
  // Any member of the group can read notices — this is the whole point,
  // an admin-to-members announcement board. Scoped by group_id from the
  // session, never a client-supplied value.
  router.get("/api/notices", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);
    const notices = await env.DB.prepare(
      `SELECT id, message, posted_by as postedBy, posted_at as postedAt
       FROM notices WHERE group_id = ? ORDER BY posted_at DESC LIMIT 20`
    ).bind(user.groupId).all();
    return json({ notices: notices.results || [] }, 200, cors);
  });

  router.post("/api/notices", async ({ request, env, cors }) => {
    const admin = await requireAdmin(request, env);
    const body = await request.json();
    if (!body.message || !body.message.trim()) throw new HttpError(400, "A message is required.");
    if (body.message.length > 500) throw new HttpError(400, "Keep notices under 500 characters.");

    const id = uid();
    await env.DB.prepare(
      `INSERT INTO notices (id, group_id, message, posted_by) VALUES (?,?,?,?)`
    ).bind(id, admin.groupId, body.message.trim(), admin.name).run();

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
