import { sendPush } from "./push.js";
import { sendSms } from "./sms.js";
import { selectReminderCandidates } from "./reminderSelection.js";

/**
 * Runs on a schedule (see [triggers] in wrangler.toml — daily is enough;
 * it only actually sends on the day a member's configured lead time
 * matches an upcoming due date, and reminder_log stops duplicates if the
 * cron fires more than once).
 *
 * One deployment can host many groups, so this loops over every group and
 * runs an independent sweep for each — one group's schedule, members, or
 * volume of reminders never affects another's. Within a single group, the
 * queries are still batched the same way as before multi-tenancy: fetch
 * every input in a fixed, small number of queries up front (now scoped by
 * group_id), decide who needs a reminder with a pure in-memory function
 * (see reminderSelection.js), and only touch the database again for the
 * sends that actually happen. reminder_log has no group_id column of its
 * own — it doesn't need one, since a row's user_id already belongs to
 * exactly one group, so it's scoped via a join to users instead.
 */
export async function runReminderSweep(env) {
  const groupsResult = await env.DB.prepare(`SELECT id, schedule_json, funds_json, recipient_exempt FROM groups`).all();
  const groups = groupsResult.results || [];
  for (const group of groups) {
    await runSweepForGroup(env, group);
  }
}

async function runSweepForGroup(env, group) {
  const schedule = JSON.parse(group.schedule_json || "[]");
  const recipientExempt = !!group.recipient_exempt;
  if (schedule.length === 0) return;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [usersResult, overridesResult, sentResult, subsResult] = await Promise.all([
    env.DB.prepare(
      `SELECT u.id, u.name, u.display_name as displayName, r.push_enabled as pushEnabled,
              r.sms_enabled as smsEnabled, r.phone, r.lead_days as leadDays
       FROM users u JOIN reminder_prefs r ON r.user_id = u.id
       WHERE u.group_id = ? AND (r.push_enabled = 1 OR r.sms_enabled = 1)`
    ).bind(group.id).all(),
    env.DB.prepare(`SELECT user_id, schedule_row_id, amount FROM due_overrides WHERE group_id = ?`).bind(group.id).all(),
    env.DB.prepare(
      `SELECT rl.user_id, rl.schedule_row_id, rl.channel
       FROM reminder_log rl JOIN users u ON u.id = rl.user_id
       WHERE u.group_id = ?`
    ).bind(group.id).all(),
    env.DB.prepare(`SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE group_id = ?`).bind(group.id).all(),
  ]);

  const users = usersResult.results || [];
  if (users.length === 0) return;

  const dueOverrides = new Map(
    (overridesResult.results || []).map((o) => [`${o.user_id}|${o.schedule_row_id}`, o.amount])
  );
  const alreadySent = new Set(
    (sentResult.results || []).map((s) => `${s.user_id}|${s.schedule_row_id}|${s.channel}`)
  );
  const subsByUser = new Map();
  for (const sub of subsResult.results || []) {
    if (!subsByUser.has(sub.user_id)) subsByUser.set(sub.user_id, []);
    subsByUser.get(sub.user_id).push(sub);
  }

  const candidates = selectReminderCandidates({ schedule, users, dueOverrides, alreadySent, today, recipientExempt });
  if (candidates.length === 0) return;

  const logInserts = [];
  const expiredSubIds = [];

  for (const { user, row, amount, channel } of candidates) {
    if (channel === "push") {
      const subs = subsByUser.get(user.id) || [];
      const message = {
        title: "Chilimba payment due soon",
        body: `K${amount.toLocaleString()} is due on ${row.date} (${row.group}).`,
        url: "/",
      };
      for (const sub of subs) {
        try {
          const result = await sendPush(env, sub, message);
          if (result.expired) expiredSubIds.push(sub.id);
        } catch (e) {
          console.error("push send failed", e);
        }
      }
      logInserts.push({ userId: user.id, rowId: row.id, channel: "push" });
    }

    if (channel === "sms") {
      const smsText = `Chilimba reminder: K${amount.toLocaleString()} due ${row.date} for ${row.group}.`;
      try {
        await sendSms(env, user.phone, smsText);
      } catch (e) {
        console.error("sms send failed", e);
      }
      logInserts.push({ userId: user.id, rowId: row.id, channel: "sms" });
    }
  }

  const writes = [
    ...logInserts.map(({ userId, rowId, channel }) =>
      env.DB.prepare(`INSERT INTO reminder_log (user_id, schedule_row_id, channel) VALUES (?,?,?)`)
        .bind(userId, rowId, channel)
    ),
    ...expiredSubIds.map((id) =>
      env.DB.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).bind(id)
    ),
  ];
  if (writes.length) await env.DB.batch(writes);
}
