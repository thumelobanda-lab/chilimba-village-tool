import { requireSession, requireAdmin } from "../auth.js";
import { HttpError } from "../httpError.js";
import { maskPhone, uid } from "../crypto.js";
import { json } from "../responses.js";
import { isSubscriptionActive, subscriptionPrice, subscriptionDurationDays, FREE_TIER_MAX_MEMBERS } from "../subscriptionUtils.js";

export default function registerSubscriptionRoutes(router) {
  // Any signed-in member of the group can check its subscription status
  // — every group is now usable at this endpoint's "active: false" too
  // (free tier), not blocked outright, so this is informational rather
  // than a gate. requireSession (not requireAdmin) is correct here on
  // purpose.
  router.get("/api/subscription/group", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);
    const group = await env.DB.prepare(`SELECT subscription_expires_at FROM groups WHERE id = ?`)
      .bind(user.groupId).first();
    const active = isSubscriptionActive(group?.subscription_expires_at);

    // A pending claim (if any) is worth surfacing too, so an admin who
    // already submitted one sees "awaiting confirmation" rather than
    // the payment form again.
    const pending = await env.DB.prepare(
      `SELECT id, paid_at as paidAt FROM group_subscriptions WHERE group_id = ? AND status = 'pending' ORDER BY paid_at DESC LIMIT 1`
    ).bind(user.groupId).first();
    const memberCountRow = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM users WHERE group_id = ? AND active = 1`
    ).bind(user.groupId).first();

    return json({
      active,
      status: active ? "active" : "free",
      expiresAt: group?.subscription_expires_at || null,
      price: subscriptionPrice(),
      durationDays: subscriptionDurationDays(),
      freeTierMaxMembers: FREE_TIER_MAX_MEMBERS,
      memberCount: memberCountRow?.count || 0,
      pending: pending || null,
    }, 200, cors);
  });

  // Admin-only. Submits a K100 payment CLAIM — it does NOT activate
  // anything by itself anymore. Previously this endpoint was a
  // placeholder that always "succeeded" and activated the group
  // instantly (no real mobile money gateway is wired up — see the old
  // version's comment); that meant any admin could grant their own
  // group 6 months of access for free, and two real groups did exactly
  // that before this was caught. Now the claim lands as 'pending' and
  // only a platform owner confirming it (POST /api/owner/subscriptions/
  // :id/confirm, routes/owner.js) after actually checking the money
  // arrived sets groups.subscription_expires_at — the same
  // "self-reported, then separately verified" shape as a member's own
  // payment + admin confirmation (migration 004).
  router.post("/api/subscription/charge", async ({ request, env, cors }) => {
    const admin = await requireAdmin(request, env);
    const body = await request.json();
    if (!body.phone || !body.network) throw new HttpError(400, "phone and network are required.");

    const existingPending = await env.DB.prepare(
      `SELECT id FROM group_subscriptions WHERE group_id = ? AND status = 'pending'`
    ).bind(admin.groupId).first();
    if (existingPending) throw new HttpError(409, "A payment claim is already pending review for this group.");

    // --- Plug in your real mobile money aggregator here, once you have
    // one, to charge automatically instead of collecting a self-reported
    // claim for manual verification ---
    const reference = `PENDING-${uid()}`;
    const id = uid();

    await env.DB.prepare(
      `INSERT INTO group_subscriptions (id, group_id, paid_by, masked_phone, network, amount, reference, paid_at, status)
       VALUES (?,?,?,?,?,?,?,datetime('now'),'pending')`
    ).bind(id, admin.groupId, admin.name, maskPhone(body.phone), body.network, subscriptionPrice(), reference).run();

    return json({ status: "pending", reference }, 200, cors);
  });
}
