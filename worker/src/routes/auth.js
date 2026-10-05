import { login, joinGroup, logoutSession } from "../auth.js";
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
    const { groupSlug, name, phone, pin, termsAccepted, title, gender } = await request.json();
    const session = await joinGroup(env, groupSlug, name, phone, pin, termsAccepted, title, gender);
    return json(session, 201, cors);
  });

  // Invalidates this one session server-side (deletes its row by hash —
  // see logoutSession in auth.js), so a token that's already out in the
  // world (an old device, a stolen one) stops working the moment someone
  // signs out, not just when it eventually expires. Idempotent and never
  // errors on a missing/already-expired token, same as owner logout
  // (routes/owner.js) — signing out is always a success from the client's
  // point of view.
  router.post("/api/logout", async ({ request, env, cors }) => {
    const auth = request.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    await logoutSession(env, token);
    return json({ ok: true }, 200, cors);
  });
}
