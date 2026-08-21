import { requireOwner, ownerLogin, ownerLogout } from "../ownerAuth.js";
import { HttpError } from "../httpError.js";
import { json } from "../responses.js";
import { isSubscriptionActive, computeExpiryDate } from "../subscriptionUtils.js";
import { detectSharedSignalFraud } from "../fraudSignals.js";

/**
 * Platform-owner routes — entirely separate surface from every other
 * route file: gated by requireOwner (owner_sessions), never requireAdmin
 * or requireSession (sessions/users). The owner can see everything
 * happening across every group and confirm/reject/suspend, but never
 * creates a group or a group's admin — that stays self-service via
 * POST /api/groups, unchanged (see that route's own comment).
 */
export default function registerOwnerRoutes(router) {
  router.post("/api/owner/login", async ({ request, env, cors }) => {
    const { email, password } = await request.json();
    const session = await ownerLogin(env, email, password);
    return json(session, 200, cors);
  });

  router.post("/api/owner/logout", async ({ request, env, cors }) => {
    const auth = request.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    await ownerLogout(env, token);
    return json({ ok: true }, 200, cors);
  });

  // Headline figures for the dashboard's landing view — total groups,
  // the free/premium split, confirmed revenue, and how many payment
  // claims are sitting in the queue waiting on a real check.
  router.get("/api/owner/overview", async ({ request, env, cors }) => {
    await requireOwner(request, env);

    const groupsResult = await env.DB.prepare(
      `SELECT id, group_name as groupName, subscription_expires_at as subscriptionExpiresAt,
              suspended_at as suspendedAt, created_at as createdAt,
              created_ip as createdIp, created_by_phone as createdByPhone
       FROM groups`
    ).all();
    const groups = groupsResult.results || [];

    const totalGroups = groups.length;
    const suspendedCount = groups.filter((g) => g.suspendedAt).length;
    const premiumCount = groups.filter((g) => isSubscriptionActive(g.subscriptionExpiresAt)).length;
    const freeCount = totalGroups - premiumCount;

    const revenueRow = await env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM group_subscriptions WHERE status = 'confirmed'`
    ).first();
    const pendingRow = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM group_subscriptions WHERE status = 'pending'`
    ).first();

    const fraudSignals = detectSharedSignalFraud(groups);

    return json({
      totalGroups,
      premiumCount,
      freeCount,
      suspendedCount,
      confirmedRevenue: revenueRow.total,
      confirmedPaymentCount: revenueRow.count,
      pendingCount: pendingRow.count,
      fraudSignals,
    }, 200, cors);
  });

  // The full roster of groups, one row each, with enough to act on —
  // member count, tier, suspension state. No PIN, payment ledger, or
  // schedule detail here; that's not what "see everything happening
  // across the platform" needs to mean day to day, and every group
  // already has its own admin who owns that detail.
  router.get("/api/owner/groups", async ({ request, env, cors }) => {
    await requireOwner(request, env);

    const groupsResult = await env.DB.prepare(
      `SELECT g.id, g.slug, g.group_name as groupName, g.subscription_expires_at as subscriptionExpiresAt,
              g.suspended_at as suspendedAt, g.suspended_reason as suspendedReason, g.suspended_by as suspendedBy,
              g.created_at as createdAt, g.created_ip as createdIp, g.created_by_phone as createdByPhone,
              (SELECT COUNT(*) FROM users u WHERE u.group_id = g.id AND u.active = 1) as memberCount
       FROM groups g ORDER BY g.created_at DESC`
    ).all();

    const groups = (groupsResult.results || []).map((g) => ({
      ...g,
      tier: isSubscriptionActive(g.subscriptionExpiresAt) ? "premium" : "free",
    }));
    return json({ groups }, 200, cors);
  });

  router.get("/api/owner/subscriptions/pending", async ({ request, env, cors }) => {
    await requireOwner(request, env);
    const result = await env.DB.prepare(
      `SELECT gs.id, gs.group_id as groupId, g.group_name as groupName, gs.paid_by as paidBy,
              gs.masked_phone as maskedPhone, gs.network, gs.amount, gs.reference, gs.paid_at as paidAt
       FROM group_subscriptions gs JOIN groups g ON g.id = gs.group_id
       WHERE gs.status = 'pending' ORDER BY gs.paid_at ASC`
    ).all();
    return json({ pending: result.results || [] }, 200, cors);
  });

  // Confirms a submitted payment claim actually arrived — the ONLY
  // place groups.subscription_expires_at gets set to a real value. The
  // 6-month window is computed from now (confirmation time), not from
  // when the claim was submitted, so a claim that sat in the queue for
  // a few days doesn't cost the group part of what it paid for.
  router.post("/api/owner/subscriptions/:id/confirm", async ({ request, env, params, cors }) => {
    const owner = await requireOwner(request, env);
    const sub = await env.DB.prepare(`SELECT * FROM group_subscriptions WHERE id = ?`).bind(params.id).first();
    if (!sub) throw new HttpError(404, "Subscription request not found.");
    if (sub.status !== "pending") throw new HttpError(400, `Already ${sub.status}.`);

    const expiresAt = computeExpiryDate().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE group_subscriptions SET status = 'confirmed', expires_at = ?, confirmed_at = datetime('now'), confirmed_by = ? WHERE id = ?`
      ).bind(expiresAt, owner.email, params.id),
      env.DB.prepare(`UPDATE groups SET subscription_expires_at = ? WHERE id = ?`).bind(expiresAt, sub.group_id),
    ]);
    return json({ ok: true, expiresAt }, 200, cors);
  });

  router.post("/api/owner/subscriptions/:id/reject", async ({ request, env, params, cors }) => {
    const owner = await requireOwner(request, env);
    const body = await request.json().catch(() => ({}));
    const sub = await env.DB.prepare(`SELECT id, status FROM group_subscriptions WHERE id = ?`).bind(params.id).first();
    if (!sub) throw new HttpError(404, "Subscription request not found.");
    if (sub.status !== "pending") throw new HttpError(400, `Already ${sub.status}.`);

    await env.DB.prepare(
      `UPDATE group_subscriptions SET status = 'rejected', confirmed_at = datetime('now'), confirmed_by = ?, notes = ? WHERE id = ?`
    ).bind(owner.email, body.notes || "", params.id).run();
    return json({ ok: true }, 200, cors);
  });

  // Suspending is immediate and total — every current session for every
  // member of the group is invalidated (same pattern as removing a
  // single member in routes/admin.js), and getSessionUser (auth.js)
  // refuses any NEW session for a suspended group's users too, so
  // there's no way back in until an owner unsuspends.
  router.post("/api/owner/groups/:id/suspend", async ({ request, env, params, cors }) => {
    const owner = await requireOwner(request, env);
    const body = await request.json().catch(() => ({}));
    if (!body.reason || !body.reason.trim()) throw new HttpError(400, "A reason is required to suspend a group.");

    const group = await env.DB.prepare(`SELECT id FROM groups WHERE id = ?`).bind(params.id).first();
    if (!group) throw new HttpError(404, "Group not found.");

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE groups SET suspended_at = datetime('now'), suspended_reason = ?, suspended_by = ? WHERE id = ?`
      ).bind(body.reason.trim(), owner.email, params.id),
      env.DB.prepare(
        `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE group_id = ?)`
      ).bind(params.id),
    ]);
    return json({ ok: true }, 200, cors);
  });

  router.post("/api/owner/groups/:id/unsuspend", async ({ request, env, params, cors }) => {
    await requireOwner(request, env);
    const group = await env.DB.prepare(`SELECT id FROM groups WHERE id = ?`).bind(params.id).first();
    if (!group) throw new HttpError(404, "Group not found.");

    await env.DB.prepare(
      `UPDATE groups SET suspended_at = NULL, suspended_reason = NULL, suspended_by = NULL WHERE id = ?`
    ).bind(params.id).run();
    return json({ ok: true }, 200, cors);
  });
}
