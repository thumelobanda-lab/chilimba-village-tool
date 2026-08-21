import { requireSession, requireAdmin } from "../auth.js";
import { HttpError } from "../httpError.js";
import { json } from "../responses.js";

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
