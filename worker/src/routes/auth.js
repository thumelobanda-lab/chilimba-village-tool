import { loginOrCreate } from "../auth.js";
import { HttpError } from "../httpError.js";
import { json } from "../responses.js";

export default function registerAuthRoutes(router) {
  router.post("/api/login", async ({ request, env, cors }) => {
    const { groupSlug, name, pin } = await request.json();
    if (!name || !name.trim()) throw new HttpError(400, "Name is required.");
    const session = await loginOrCreate(env, groupSlug, name, pin);
    return json(session, 200, cors);
  });
}
