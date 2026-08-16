import { requireSession } from "../auth.js";
import { json } from "../responses.js";

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
}
