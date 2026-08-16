import { requireSession } from "../auth.js";
import { HttpError } from "../httpError.js";
import { uid } from "../crypto.js";
import { json } from "../responses.js";

export default function registerPushRoutes(router) {
  router.post("/api/push/subscribe", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);
    const body = await request.json(); // { endpoint, keys: { p256dh, auth } }
    if (!body.endpoint || !body.keys) throw new HttpError(400, "Invalid subscription.");
    await env.DB.prepare(
      `INSERT INTO push_subscriptions (id, group_id, user_id, endpoint, p256dh, auth) VALUES (?,?,?,?,?,?)
       ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, p256dh=excluded.p256dh, auth=excluded.auth`
    ).bind(uid(), user.groupId, user.id, body.endpoint, body.keys.p256dh, body.keys.auth).run();
    return json({ ok: true }, 201, cors);
  });

  router.del("/api/push/subscribe", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);
    const body = await request.json();
    await env.DB.prepare(`DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?`)
      .bind(user.id, body.endpoint).run();
    return json({ ok: true }, 200, cors);
  });
}
