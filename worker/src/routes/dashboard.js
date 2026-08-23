import { requireSession } from "../auth.js";
import { json } from "../responses.js";
import { computeGroupPulse } from "../dashboardPulse.js";
import { computeGRS } from "../reliability.js";

export default function registerDashboardRoutes(router) {
  // "Group Pulse" — aggregate-only figures for the home dashboard's
  // group-wide section (see computeGroupPulse.js for why this stops at
  // aggregates and never lists who's paid). Any signed-in member of the
  // group can see this, same as funds.js — it's group-wide but not
  // individually identifying. GRS (Group Reliability Score) rides along
  // on this same response for the same reason: it's a group-level
  // aggregate visible to every member, not per-member detail.
  router.get("/api/dashboard/pulse", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);

    const group = await env.DB.prepare(`SELECT schedule_json, recipient_exempt FROM groups WHERE id = ?`)
      .bind(user.groupId).first();
    const schedule = JSON.parse(group?.schedule_json || "[]");
    const scheduleRowIds = new Set(schedule.map((r) => r.id));
    const recipientExempt = !!group?.recipient_exempt;

    // Joined to display_name (not just user_id) — GRS needs the actual
    // name to resolve recipient-exemption/due the same way the rest of
    // the app does (isRecipient/resolveDue match by name, not id).
    const paymentsResult = await env.DB.prepare(
      `SELECT p.amount, p.schedule_row_id as scheduleRowId, p.user_id as userId, p.recorded_at as recordedAt,
              u.display_name as memberName
       FROM payments p JOIN users u ON u.id = p.user_id
       WHERE p.group_id = ? AND p.voided_at IS NULL`
    ).bind(user.groupId).all();
    const payments = paymentsResult.results || [];

    const membersResult = await env.DB.prepare(
      `SELECT display_name as name FROM users WHERE group_id = ? AND active = 1`
    ).bind(user.groupId).all();
    const memberNames = (membersResult.results || []).map((m) => m.name);

    const pulse = computeGroupPulse(payments, scheduleRowIds, memberNames.length);
    // Deliberately ignores per-member due overrides (see reliability.js)
    // — a rare, personal-rate edge case that would meaningfully
    // complicate this lightweight aggregate endpoint for a marginal
    // accuracy gain on a score that's meant to be a rough signal, not a
    // penny-precise audit.
    const grs = computeGRS(schedule, payments, memberNames, recipientExempt);

    return json({ ...pulse, grs }, 200, cors);
  });
}
