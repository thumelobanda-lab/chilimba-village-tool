import { uid } from "./crypto.js";
import { isRecipient as isRecipientHelper, resolveDue } from "./scheduleUtils.js";
import { crossedDueThreshold } from "./fundUtils.js";

// Fires once per member per date, the moment their cumulative payments for
// that date cross from below their due amount to at or above it. Skips
// entirely if it's their own payout date (due = 0) or they've already
// been recorded for this date (the UNIQUE constraint on fund_contributions
// also guards against this at the DB level, so a race is harmless).
export async function maybeRecordFundContributions(env, user, scheduleRowId, paidBefore, paidAfter) {
  const config = await env.DB.prepare(`SELECT * FROM groups WHERE id = ?`).bind(user.groupId).first();
  if (!config) return;
  const schedule = JSON.parse(config.schedule_json || "[]");
  const funds = JSON.parse(config.funds_json || "[]");
  const row = schedule.find((r) => r.id === scheduleRowId);
  if (!row || funds.length === 0) return;

  const isRecipient = isRecipientHelper(row, user.name, !!config.recipient_exempt);
  if (isRecipient) return; // skip the override lookup entirely for a recipient row

  const overrideRow = await env.DB.prepare(
    `SELECT amount FROM due_overrides WHERE user_id = ? AND schedule_row_id = ?`
  ).bind(user.id, scheduleRowId).first();
  const due = resolveDue(row, user.name, !!config.recipient_exempt, overrideRow?.amount);
  if (!crossedDueThreshold(paidBefore, paidAfter, due)) return;

  const stmts = funds.map((f) =>
    env.DB.prepare(
      `INSERT OR IGNORE INTO fund_contributions (id, group_id, user_id, display_name, schedule_row_id, fund_id, amount)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(uid(), user.groupId, user.id, user.name, scheduleRowId, f.id, f.amount)
  );
  if (stmts.length) await env.DB.batch(stmts);
}
