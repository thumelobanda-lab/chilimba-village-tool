import { requireSession, requireAdmin } from "../auth.js";
import { json } from "../responses.js";
import { HttpError } from "../httpError.js";
import { sendPush } from "../push.js";
import { sendSms } from "../sms.js";

export default function registerReminderRoutes(router) {
  router.get("/api/reminders/prefs", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);
    const prefs = await env.DB.prepare(
      `SELECT push_enabled as pushEnabled, sms_enabled as smsEnabled, phone, lead_days as leadDays
       FROM reminder_prefs WHERE user_id = ?`
    ).bind(user.id).first();
    return json(prefs || { pushEnabled: false, smsEnabled: false, phone: null, leadDays: 2 }, 200, cors);
  });

  router.put("/api/reminders/prefs", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);
    const body = await request.json();
    await env.DB.prepare(
      `INSERT INTO reminder_prefs (user_id, group_id, push_enabled, sms_enabled, phone, lead_days) VALUES (?,?,?,?,?,?)
       ON CONFLICT(user_id) DO UPDATE SET push_enabled=excluded.push_enabled, sms_enabled=excluded.sms_enabled,
         phone=excluded.phone, lead_days=excluded.lead_days, updated_at=datetime('now')`
    ).bind(
      user.id,
      user.groupId,
      body.pushEnabled ? 1 : 0,
      body.smsEnabled ? 1 : 0,
      body.phone || null,
      Number(body.leadDays) || 2
    ).run();
    return json({ ok: true }, 200, cors);
  });

  // A member's own per-date overrides, keyed by scheduleRowId — no row
  // means "use my default lead time" (from reminder_prefs above).
  router.get("/api/reminders/date-overrides", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);
    const rows = await env.DB.prepare(
      `SELECT schedule_row_id as scheduleRowId, lead_days as leadDays, muted
       FROM reminder_date_overrides WHERE user_id = ?`
    ).bind(user.id).all();
    const overrides = {};
    for (const r of rows.results || []) {
      overrides[r.scheduleRowId] = { leadDays: r.leadDays, muted: !!r.muted };
    }
    return json({ overrides }, 200, cors);
  });

  // Sets (or clears) an override for one date. Passing leadDays: null and
  // muted: false clears it back to "use my default" by deleting the row
  // entirely, rather than leaving a no-op row behind.
  router.put("/api/reminders/date-overrides/:rowId", async ({ request, env, params, cors }) => {
    const user = await requireSession(request, env);
    const body = await request.json();
    const leadDays = body.leadDays === null || body.leadDays === undefined ? null : Number(body.leadDays);
    const muted = !!body.muted;

    if (leadDays === null && !muted) {
      await env.DB.prepare(`DELETE FROM reminder_date_overrides WHERE user_id = ? AND schedule_row_id = ?`)
        .bind(user.id, params.rowId).run();
      return json({ ok: true }, 200, cors);
    }

    await env.DB.prepare(
      `INSERT INTO reminder_date_overrides (user_id, group_id, schedule_row_id, lead_days, muted) VALUES (?,?,?,?,?)
       ON CONFLICT(user_id, schedule_row_id) DO UPDATE SET lead_days=excluded.lead_days, muted=excluded.muted, updated_at=datetime('now')`
    ).bind(user.id, user.groupId, params.rowId, leadDays, muted ? 1 : 0).run();
    return json({ ok: true }, 200, cors);
  });

  // Admin-only, on-demand single reminder — the dashboard's rotation
  // strip long-press shortcut, distinct from the automated daily sweep
  // (runReminderSweep in reminders.js) in two ways: it's one member, sent
  // right now, and deliberately NOT gated behind an active subscription
  // the way the automated sweep is (subscriptionUtils.js's
  // isSubscriptionActive) — that gate exists to keep a free-tier group
  // from getting the recurring, ongoing automated feature for free, which
  // doesn't apply to an admin manually nudging one person once. Still
  // only ever sends through channels the member themselves opted into
  // (reminder_prefs) — an admin can prompt a send, not choose the
  // member's channel or bypass their preferences.
  router.post("/api/reminders/send-now", async ({ request, env, cors }) => {
    const admin = await requireAdmin(request, env);
    const body = await request.json();
    const memberName = (body.memberName || "").trim();
    if (!memberName) throw new HttpError(400, "memberName is required.");

    const target = await env.DB.prepare(
      `SELECT u.id, r.push_enabled as pushEnabled, r.sms_enabled as smsEnabled, r.phone
       FROM users u LEFT JOIN reminder_prefs r ON r.user_id = u.id
       WHERE u.group_id = ? AND u.name = ?`
    ).bind(admin.groupId, memberName).first();
    if (!target) throw new HttpError(404, "Member not found.");

    let sent = false;

    if (target.pushEnabled) {
      const subs = await env.DB.prepare(
        `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`
      ).bind(target.id).all();
      const expiredSubIds = [];
      for (const sub of subs.results || []) {
        try {
          const result = await sendPush(env, sub, {
            title: "Chilimba reminder",
            body: "A group leader sent you a nudge about your upcoming Chilimba payment.",
            url: "/",
          });
          if (result.expired) expiredSubIds.push(sub.id);
          else sent = true;
        } catch (e) {
          console.error("send-now push failed", e);
        }
      }
      if (expiredSubIds.length) {
        await env.DB.batch(
          expiredSubIds.map((id) => env.DB.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).bind(id))
        );
      }
    }

    if (target.smsEnabled && target.phone) {
      try {
        const result = await sendSms(env, target.phone, "Chilimba: a group leader sent you a reminder about your upcoming payment.");
        if (result?.ok !== false) sent = true;
      } catch (e) {
        console.error("send-now sms failed", e);
      }
    }

    if (!sent) {
      return json({ ok: false, reason: "This member hasn't enabled push or SMS reminders yet." }, 200, cors);
    }
    return json({ ok: true }, 200, cors);
  });
}
