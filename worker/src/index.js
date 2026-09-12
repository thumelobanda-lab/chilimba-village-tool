import { HttpError } from "./httpError.js";
import { corsHeaders, json } from "./responses.js";
import { createRouter } from "./router.js";
import { runReminderSweep } from "./reminders.js";
import { D1BackupWorkflow } from "./backupWorkflow.js";

// Cloudflare requires a Workflow class to be exported by name from the
// same module `main` in wrangler.toml points at, regardless of how
// instances of it get created — see scheduled() below, which starts one
// on the backup cron via env.D1_BACKUP_WORKFLOW.create().
export { D1BackupWorkflow };

// The two [triggers].crons strings in wrangler.toml, matched against
// event.cron below so one scheduled() handler can dispatch to either
// job by exact string rather than guessing from time-of-day.
const REMINDER_CRON = "0 6 * * *";
const BACKUP_CRON = "30 2 * * *";

import registerAuthRoutes from "./routes/auth.js";
import registerProfileRoutes from "./routes/profile.js";
import registerGroupRoutes from "./routes/groups.js";
import registerScheduleRoutes from "./routes/schedule.js";
import registerContributionsRoutes from "./routes/contributions.js";
import registerSubscriptionRoutes from "./routes/subscription.js";
import registerReminderRoutes from "./routes/reminders.js";
import registerPushRoutes from "./routes/push.js";
import registerFundsRoutes from "./routes/funds.js";
import registerAdminRoutes from "./routes/admin.js";
import registerNoticeRoutes from "./routes/notices.js";
import registerNotepadRoutes from "./routes/notepad.js";
import registerProfilePhotoRoutes from "./routes/profilePhoto.js";
import registerDashboardRoutes from "./routes/dashboard.js";
import registerOwnerRoutes from "./routes/owner.js";
import registerMessageRoutes from "./routes/messages.js";
import registerPublicContactRoutes from "./routes/publicContact.js";

const router = createRouter();
router.use(registerAuthRoutes);
router.use(registerProfileRoutes);
router.use(registerGroupRoutes);
router.use(registerScheduleRoutes);
router.use(registerContributionsRoutes);
router.use(registerSubscriptionRoutes);
router.use(registerReminderRoutes);
router.use(registerPushRoutes);
router.use(registerFundsRoutes);
router.use(registerAdminRoutes);
router.use(registerNoticeRoutes);
router.use(registerNotepadRoutes);
router.use(registerProfilePhotoRoutes);
router.use(registerDashboardRoutes);
router.use(registerOwnerRoutes);
router.use(registerMessageRoutes);
router.use(registerPublicContactRoutes);

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
        return json({ error: "Something went wrong on our end. Please try again in a moment." }, 500, cors);
      }
      return json({ error: err.message }, status, cors);
    }
  },

  // Cron trigger — see [triggers] in wrangler.toml. event.cron tells us
  // which of the two configured schedules just fired; staging only ever
  // gets BACKUP_CRON (see [env.staging.triggers]), so REMINDER_CRON
  // simply never matches there.
  async scheduled(event, env, ctx) {
    if (event.cron === BACKUP_CRON) {
      ctx.waitUntil(env.D1_BACKUP_WORKFLOW.create());
      return;
    }
    if (event.cron === REMINDER_CRON) {
      ctx.waitUntil(runReminderSweep(env));
    }
  },
};
