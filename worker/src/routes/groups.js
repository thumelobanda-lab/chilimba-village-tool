import { createGroup } from "../auth.js";
import { HttpError } from "../httpError.js";
import { json } from "../responses.js";

export default function registerGroupRoutes(router) {
  // Deliberately unauthenticated — there's no session to require yet
  // when a group doesn't exist. createGroup() itself validates every
  // field and rejects a taken slug; the new admin is the only account
  // this creates, so it can't be used to tamper with an existing group.
  router.post("/api/groups", async ({ request, env, cors }) => {
    const body = await request.json();
    if (!body.slug || !body.groupName || !body.adminName || !body.pin) {
      throw new HttpError(400, "slug, groupName, adminName, and pin are all required.");
    }
    // A fraud-detection fingerprint only (routes/owner.js's overview),
    // never used to gate creation itself — group creation stays
    // self-service regardless of what this header does or doesn't say.
    const createdIp = request.headers.get("CF-Connecting-IP") || null;
    const session = await createGroup(env, { ...body, createdIp });
    return json(session, 201, cors);
  });
}
