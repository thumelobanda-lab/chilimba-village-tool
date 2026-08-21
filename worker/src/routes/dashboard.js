import { requireSession } from "../auth.js";
import { json } from "../responses.js";
import { computeGroupPulse } from "../dashboardPulse.js";

export default function registerDashboardRoutes(router) {
  // "Group Pulse" — aggregate-only figures for the home dashboard's
  // group-wide section (see computeGroupPulse.js for why this stops at
  // aggregates and never lists who's paid). Any signed-in member of the
  // group can see this, same as funds.js — it's group-wide but not
  // individually identifying.
  router.get("/api/dashboard/pulse", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);

    const group = await env.DB.prepare(`SELECT schedule_json FROM groups WHERE id = ?`)
      .bind(user.groupId).first();
    const scheduleRowIds = new Set(JSON.parse(group?.schedule_json || "[]").map((r) => r.id));

    const paymentsResult = await env.DB.prepare(
      `SELECT amount, schedule_row_id as scheduleRowId, user_id as userId, recorded_at as recordedAt
       FROM payments WHERE group_id = ? AND voided_at IS NULL`
    ).bind(user.groupId).all();

    const membersResult = await env.DB.prepare(
      `SELECT COUNT(*) as n FROM users WHERE group_id = ? AND active = 1`
    ).bind(user.groupId).first();

    const pulse = computeGroupPulse(
      paymentsResult.results || [],
      scheduleRowIds,
      membersResult?.n || 0
    );

    return json(pulse, 200, cors);
  });
}
