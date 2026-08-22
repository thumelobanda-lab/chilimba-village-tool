import { login, joinGroup } from "../auth.js";
import { json } from "../responses.js";

export default function registerAuthRoutes(router) {
  // Sign in only — an existing account's name or phone number + PIN.
  // Never creates an account; see POST /api/join for that.
  router.post("/api/login", async ({ request, env, cors }) => {
    const { groupSlug, identifier, pin } = await request.json();
    const session = await login(env, groupSlug, identifier, pin);
    return json(session, 200, cors);
  });

  // Sign up — creates a brand-new member account. Full name and phone
  // number are both required; see joinGroup() in auth.js for why phone
  // is collected here and nowhere else in the login flow.
  router.post("/api/join", async ({ request, env, cors }) => {
    const { groupSlug, name, phone, pin, termsAccepted } = await request.json();
    const session = await joinGroup(env, groupSlug, name, phone, pin, termsAccepted);
    return json(session, 201, cors);
  });
}
