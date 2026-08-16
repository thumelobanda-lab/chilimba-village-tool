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
    const session = await createGroup(env, body);
    return json(session, 201, cors);
  });
}
