import { requireSession } from "../auth.js";
import { HttpError } from "../httpError.js";
import { json } from "../responses.js";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB — the client is expected to downscale/compress
                                    // before ever uploading (see src/lib/imageResize.js), so
                                    // this is a hard backstop against a client that skipped
                                    // that step, not the expected normal size.
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// One deterministic key per member, group-prefixed — re-uploading always
// overwrites the same R2 object (no orphaned old photos to clean up on
// replace), and the group prefix means a runaway `list()` or a key typo
// can never cross into another group's photos, same isolation principle
// as every D1 query in this app being scoped by group_id.
function photoKeyFor(groupId, userId) {
  return `avatars/${groupId}/${userId}`;
}

export default function registerProfilePhotoRoutes(router) {
  // Self-service upload — always the signed-in member's OWN photo, same
  // as displayName/PIN in routes/profile.js. Body is the raw image
  // bytes; Content-Type on the request is what's validated and stored
  // as the R2 object's own httpMetadata.contentType, so GET below can
  // serve it back with the right header without needing the key itself
  // to carry a file extension.
  router.post("/api/profile/photo", async ({ request, env, cors }) => {
    const session = await requireSession(request, env);
    const contentType = request.headers.get("Content-Type") || "";
    if (!ALLOWED_TYPES.has(contentType)) {
      throw new HttpError(400, "Only JPEG, PNG, or WebP photos are supported.");
    }

    const bytes = await request.arrayBuffer();
    if (bytes.byteLength === 0) throw new HttpError(400, "No image data received.");
    if (bytes.byteLength > MAX_BYTES) throw new HttpError(400, "That photo is too large — please use a smaller one.");

    const key = photoKeyFor(session.groupId, session.id);
    await env.AVATARS.put(key, bytes, { httpMetadata: { contentType } });
    await env.DB.prepare(`UPDATE users SET photo_key = ? WHERE id = ?`).bind(key, session.id).run();

    return json({ ok: true }, 200, cors);
  });

  // Self-service removal — soft-delete elsewhere in this app keeps
  // history around on purpose, but a photo isn't payment history; a
  // member removing their own photo should make it actually gone, same
  // as PIN reset clears the stored hash outright rather than keeping a
  // trail of old PINs.
  router.del("/api/profile/photo", async ({ request, env, cors }) => {
    const session = await requireSession(request, env);
    const user = await env.DB.prepare(`SELECT photo_key FROM users WHERE id = ?`).bind(session.id).first();
    if (user?.photo_key) {
      await env.AVATARS.delete(user.photo_key);
      await env.DB.prepare(`UPDATE users SET photo_key = NULL WHERE id = ?`).bind(session.id).run();
    }
    return json({ ok: true }, 200, cors);
  });

  // Serves any group member's photo — never gated to admins (same
  // transparency principle as /api/members/roster), but always scoped to
  // the caller's OWN group via the WHERE clause below, so knowing
  // someone's exact name in a different group still can't reach their
  // photo. Deliberately proxied through the Worker rather than a public
  // R2 URL — a public URL would have no way to enforce that group
  // boundary at all. Not gated by active=1: a removed member's photo
  // stays reachable by name, same "soft-delete keeps history" rule as
  // their payment records.
  router.get("/api/profile/photo/:name", async ({ request, env, params, cors }) => {
    const session = await requireSession(request, env);
    const user = await env.DB.prepare(
      `SELECT photo_key FROM users WHERE group_id = ? AND name = ?`
    ).bind(session.groupId, params.name.trim().toLowerCase()).first();
    if (!user?.photo_key) throw new HttpError(404, "No photo.");

    const object = await env.AVATARS.get(user.photo_key);
    if (!object) throw new HttpError(404, "No photo.");

    return new Response(object.body, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
        "Cache-Control": "private, max-age=300",
      },
    });
  });
}
