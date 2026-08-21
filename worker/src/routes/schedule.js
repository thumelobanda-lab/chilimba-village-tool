import { requireSession, requireAdmin } from "../auth.js";
import { HttpError } from "../httpError.js";
import { json } from "../responses.js";
import { isSubscriptionActive } from "../subscriptionUtils.js";

export default function registerScheduleRoutes(router) {
  // Now session-gated (it used to be public) — with multiple groups
  // there's no way to know which one's schedule to return without first
  // knowing who's asking. Scoped by the session's groupId, never a
  // client-supplied group id/slug.
  router.get("/api/schedule", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);
    const row = await env.DB.prepare(`SELECT * FROM groups WHERE id = ?`).bind(user.groupId).first();
    if (!row) return json(null, 200, cors);
    return json({
      groupName: row.group_name,
      cycleName: row.cycle_name,
      recipientExempt: !!row.recipient_exempt,
      schedule: JSON.parse(row.schedule_json),
      funds: JSON.parse(row.funds_json || "[]"),
      paymentMethods: JSON.parse(row.payment_info_json || "[]"),
      communityFundDeduction: row.community_fund_deduction || 0,
    }, 200, cors);
  });

  router.put("/api/schedule", async ({ request, env, cors }) => {
    const admin = await requireAdmin(request, env);
    const body = await request.json();
    const communityFundDeduction = Number(body.communityFundDeduction) || 0;
    if (communityFundDeduction < 0) throw new HttpError(400, "Community fund deduction can't be negative.");

    const group = await env.DB.prepare(`SELECT subscription_expires_at, community_fund_deduction FROM groups WHERE id = ?`)
      .bind(admin.groupId).first();
    const currentDeduction = group?.community_fund_deduction || 0;
    // Automatic community-fund splitting is premium-only — checked
    // server-side, not just left hidden/disabled in GroupSetup.jsx, so a
    // free-tier group can't enable it by calling this route directly.
    // Only blocks actually RAISING the rate, not every save that happens
    // to still carry the same (or a lower/unchanged) value forward —
    // otherwise a group that lapses from premium back to free would find
    // ALL of Group Setup refuses to save anything at all, blocked by a
    // stale field the UI doesn't even let them touch anymore (see
    // GroupSetup.jsx, which disables this input on free tier but the
    // draft object still round-trips the config's existing value).
    if (communityFundDeduction > currentDeduction && !isSubscriptionActive(group?.subscription_expires_at)) {
      throw new HttpError(402, "Automatic community fund splitting is a premium feature — activate your group's subscription first.");
    }
    await env.DB.prepare(
      `UPDATE groups SET group_name=?, cycle_name=?, recipient_exempt=?, schedule_json=?, funds_json=?, payment_info_json=?, community_fund_deduction=?, updated_at=datetime('now'), updated_by=? WHERE id=?`
    ).bind(
      body.groupName, body.cycleName, body.recipientExempt ? 1 : 0,
      JSON.stringify(body.schedule), JSON.stringify(body.funds || []),
      JSON.stringify(body.paymentMethods || []), communityFundDeduction, admin.name, admin.groupId
    ).run();
    return json({ ok: true }, 200, cors);
  });
}
