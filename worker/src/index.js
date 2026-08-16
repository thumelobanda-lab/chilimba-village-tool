import { HttpError } from "./httpError.js";
import { corsHeaders, json } from "./responses.js";
import { createRouter } from "./router.js";
import { runReminderSweep } from "./reminders.js";

import registerAuthRoutes from "./routes/auth.js";
import registerGroupRoutes from "./routes/groups.js";
import registerScheduleRoutes from "./routes/schedule.js";
import registerContributionsRoutes from "./routes/contributions.js";
import registerSubscriptionRoutes from "./routes/subscription.js";
import registerReminderRoutes from "./routes/reminders.js";
import registerPushRoutes from "./routes/push.js";
import registerFundsRoutes from "./routes/funds.js";
import registerAdminRoutes from "./routes/admin.js";

const router = createRouter();
router.use(registerAuthRoutes);
router.use(registerGroupRoutes);
router.use(registerScheduleRoutes);
router.use(registerContributionsRoutes);
router.use(registerSubscriptionRoutes);
router.use(registerReminderRoutes);
router.use(registerPushRoutes);
router.use(registerFundsRoutes);
router.use(registerAdminRoutes);

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(env, origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);

    try {
      const result = await router.handle({ request, env, ctx, url, cors });
      if (result) return result;
      return json({ error: "Not found" }, 404, cors);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) {
        // Log the real error server-side, but never hand its message to
        // the client — an uncaught exception can carry internal detail
        // (a D1 error string, a stack trace fragment) that's free
        // reconnaissance for anyone probing the API. HttpError messages
        // ARE meant for the client (they're written by our own routes to
        // be user-facing), so only this generic 500 branch is masked.
        console.error(err);
        return json({ error: "Server error" }, 500, cors);
      }
      return json({ error: err.message }, status, cors);
    }
  },

  // Cron trigger — see [triggers] in wrangler.toml.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runReminderSweep(env));
  },
};
