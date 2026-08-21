import { requireOwner, ownerLogin, ownerLogout } from "../ownerAuth.js";
import { HttpError } from "../httpError.js";
import { json } from "../responses.js";
import { uid } from "../crypto.js";
import { isSubscriptionActive, computeExpiryDate } from "../subscriptionUtils.js";
import { detectSharedSignalFraud } from "../fraudSignals.js";
import { isValidTargetType, buildTargetLabel, validateMessageBody, isValidCategory } from "../ownerMessages.js";
import { validateSupportContact } from "../platformSettings.js";

const PLATFORM_SETTINGS_ID = "default"; // singleton row — see migration 012

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

  // The member picker behind "a specific person" — one group's active
  // roster, name + role + phone (phone only so the compose screen can
  // offer a per-person WhatsApp share link; never a PIN, payment ledger,
  // or anything else). Scoped to :id like every other owner route that
  // reaches into one group, not a client-trusted slug.
  router.get("/api/owner/groups/:id/members", async ({ request, env, params, cors }) => {
    await requireOwner(request, env);
    const group = await env.DB.prepare(`SELECT id FROM groups WHERE id = ?`).bind(params.id).first();
    if (!group) throw new HttpError(404, "Group not found.");

    const result = await env.DB.prepare(
      `SELECT id, display_name as displayName, role, phone
       FROM users WHERE group_id = ? AND active = 1 ORDER BY display_name COLLATE NOCASE`
    ).bind(params.id).all();
    return json({ members: result.results || [] }, 200, cors);
  });

  // Sends a one-way platform message — to one person, every admin of a
  // group, or every member of a group (admins included: "member" here
  // means "belongs to this group", the same broad sense notices.js
  // already broadcasts to). This is the ONLY route in the whole app that
  // ever inserts into owner_messages/owner_message_recipients (migration
  // 010) — gated by requireOwner, never requireAdmin or requireSession —
  // so a group admin has no path to create or spoof one. Recipients are
  // resolved server-side from group_id + target_type, never from a
  // client-supplied recipient list, the same "never trust the client for
  // scoping" rule every other route in this file already follows.
  router.post("/api/owner/messages", async ({ request, env, cors }) => {
    const owner = await requireOwner(request, env);
    const body = await request.json();

    if (!isValidTargetType(body.targetType)) throw new HttpError(400, "Unknown target type.");
    if (!body.groupId) throw new HttpError(400, "groupId is required.");
    // "" (the compose screen's "no template" option) is normalized to
    // null here rather than treated as an unknown category string.
    const category = body.category || null;
    if (!isValidCategory(category)) throw new HttpError(400, "Unknown message category.");
    // validateMessageBody throws a plain Error (see its own comment) —
    // translated to an HttpError here so the client actually sees the
    // real reason ("A message is required.", the length cap) as a 400,
    // rather than index.js's catch-all masking every non-HttpError as a
    // generic 500 "Server error".
    let message;
    try {
      message = validateMessageBody(body.message);
    } catch (e) {
      throw new HttpError(400, e.message);
    }

    const group = await env.DB.prepare(`SELECT id, group_name as groupName FROM groups WHERE id = ?`)
      .bind(body.groupId).first();
    if (!group) throw new HttpError(404, "Group not found.");

    let recipients;
    if (body.targetType === "user") {
      if (!body.userId) throw new HttpError(400, "userId is required for an individual message.");
      const target = await env.DB.prepare(
        `SELECT id, display_name as displayName, phone FROM users WHERE id = ? AND group_id = ? AND active = 1`
      ).bind(body.userId, body.groupId).first();
      if (!target) throw new HttpError(404, "That person wasn't found in that group.");
      recipients = [target];
    } else {
      const roleFilter = body.targetType === "group_admins" ? ` AND role = 'admin'` : "";
      const result = await env.DB.prepare(
        `SELECT id, display_name as displayName, phone FROM users WHERE group_id = ? AND active = 1${roleFilter}`
      ).bind(body.groupId).all();
      recipients = result.results || [];
    }
    if (recipients.length === 0) throw new HttpError(400, "No active recipients matched — nothing was sent.");

    const targetLabel = buildTargetLabel({
      targetType: body.targetType,
      groupName: group.groupName,
      userDisplayName: recipients[0]?.displayName,
    });

    const messageId = uid();
    const whatsappRequested = body.alsoWhatsApp ? 1 : 0;
    const stmts = [
      env.DB.prepare(
        `INSERT INTO owner_messages (id, target_type, group_id, user_id, target_label, message, whatsapp_requested, category, sent_by)
         VALUES (?,?,?,?,?,?,?,?,?)`
      ).bind(
        messageId, body.targetType, body.groupId,
        body.targetType === "user" ? body.userId : null,
        targetLabel, message, whatsappRequested, category, owner.email
      ),
      ...recipients.map((r) =>
        env.DB.prepare(`INSERT INTO owner_message_recipients (id, message_id, user_id) VALUES (?,?,?)`)
          .bind(uid(), messageId, r.id)
      ),
    ];
    await env.DB.batch(stmts);

    return json({
      id: messageId,
      recipientCount: recipients.length,
      // Only what the compose screen needs to build per-person WhatsApp
      // share links (src/lib/inviteCard.js's buildWhatsAppShareUrl) —
      // nothing here is persisted beyond the log row above.
      recipients: recipients.map((r) => ({ id: r.id, name: r.displayName, phone: r.phone })),
    }, 201, cors);
  });

  // The owner's own record of what's been sent — recipient, content,
  // timestamp, same three things point 4 of the feature asked for, plus
  // enough else (target type, WhatsApp toggle) to make the log legible
  // without re-deriving it. Ordered newest-first, capped at 200 so this
  // stays a quick reference rather than an ever-growing unpaginated dump.
  router.get("/api/owner/messages", async ({ request, env, cors }) => {
    await requireOwner(request, env);
    const result = await env.DB.prepare(
      `SELECT om.id, om.target_type as targetType, om.target_label as targetLabel,
              om.message, om.whatsapp_requested as whatsappRequested, om.category,
              om.sent_by as sentBy, om.sent_at as sentAt,
              (SELECT COUNT(*) FROM owner_message_recipients omr WHERE omr.message_id = om.id) as recipientCount
       FROM owner_messages om ORDER BY om.sent_at DESC LIMIT 200`
    ).all();
    return json({ messages: result.results || [] }, 200, cors);
  });

  // The platform-wide support contact behind the [Contact] placeholder
  // in owner-messaging templates (src/lib/messageTemplates.js) — a
  // singleton, not per-owner (see migration 012's comment for why), so
  // every owner account reads and writes the same row.
  router.get("/api/owner/settings", async ({ request, env, cors }) => {
    await requireOwner(request, env);
    const row = await env.DB.prepare(
      `SELECT support_email as supportEmail, support_whatsapp as supportWhatsapp FROM platform_settings WHERE id = ?`
    ).bind(PLATFORM_SETTINGS_ID).first();
    return json(row || { supportEmail: null, supportWhatsapp: null }, 200, cors);
  });

  router.put("/api/owner/settings", async ({ request, env, cors }) => {
    const owner = await requireOwner(request, env);
    const body = await request.json();
    // Same plain-Error-to-HttpError translation as validateMessageBody
    // above — validateSupportContact's message ("Keep each contact
    // field under...") needs to reach the client as a 400, not the
    // catch-all's generic 500.
    let supportEmail, supportWhatsapp;
    try {
      ({ supportEmail, supportWhatsapp } = validateSupportContact(body));
    } catch (e) {
      throw new HttpError(400, e.message);
    }

    await env.DB.prepare(
      `INSERT INTO platform_settings (id, support_email, support_whatsapp, updated_by)
       VALUES (?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET support_email = excluded.support_email,
         support_whatsapp = excluded.support_whatsapp, updated_at = datetime('now'), updated_by = excluded.updated_by`
    ).bind(PLATFORM_SETTINGS_ID, supportEmail, supportWhatsapp, owner.email).run();

    return json({ ok: true, supportEmail, supportWhatsapp }, 200, cors);
  });
}
