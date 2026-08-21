import { requireSession } from "../auth.js";
import { HttpError } from "../httpError.js";
import { uid } from "../crypto.js";
import { json } from "../responses.js";
import { maybeRecordFundContributions } from "../fundCrediting.js";
import { EFFECTIVE_CONTRIBUTION_SQL } from "../communityFundSplit.js";

export default function registerContributionsRoutes(router) {
  router.get("/api/contributions/me", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);
    const payments = await env.DB.prepare(
      `SELECT id, schedule_row_id as scheduleRowId, amount, note, recorded_by as recordedBy,
              recorded_at as recordedAt, voided_at as voidedAt, void_reason as voidReason,
              confirmed_at as confirmedAt, confirmed_by as confirmedBy,
              community_fund_amount as communityFundAmount
       FROM payments WHERE user_id = ? ORDER BY recorded_at ASC`
    ).bind(user.id).all();
    const payout = await env.DB.prepare(
      `SELECT amount, received_date as date FROM payouts WHERE user_id = ?`
    ).bind(user.id).first();
    const overridesRows = await env.DB.prepare(
      `SELECT schedule_row_id, amount FROM due_overrides WHERE user_id = ?`
    ).bind(user.id).all();
    const dueOverrides = {};
    for (const row of overridesRows.results || []) dueOverrides[row.schedule_row_id] = row.amount;
    return json({
      payments: payments.results || [],
      payoutInfo: payout || { amount: 0, date: "" },
      dueOverrides,
    }, 200, cors);
  });

  router.post("/api/contributions/payments", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);
    const body = await request.json();
    if (!body.amount || Number(body.amount) <= 0) throw new HttpError(400, "Amount must be greater than zero.");
    const id = uid();

    // Sum this member's non-voided payments for this date BEFORE this
    // insert, so we can tell if this payment is what pushes them over
    // their due amount (fund contributions fire once, on that crossing).
    // Uses the same effective-contribution rule as everywhere else a
    // "paid" total is shown (a confirmed prior payment counts only its
    // post-community-fund-split remainder) — the new payment being
    // inserted here is always unconfirmed at this point, so it's added
    // below at its full raw amount, unaffected by that rule yet.
    const before = await env.DB.prepare(
      `SELECT COALESCE(SUM(${EFFECTIVE_CONTRIBUTION_SQL}), 0) as total FROM payments WHERE user_id = ? AND schedule_row_id = ? AND voided_at IS NULL`
    ).bind(user.id, body.scheduleRowId).first();
    const paidBefore = before.total;

    await env.DB.prepare(
      `INSERT INTO payments (id, group_id, user_id, schedule_row_id, amount, note, recorded_by) VALUES (?,?,?,?,?,?,?)`
    ).bind(id, user.groupId, user.id, body.scheduleRowId, Number(body.amount), body.note || "", user.name).run();

    await maybeRecordFundContributions(env, user, body.scheduleRowId, paidBefore, paidBefore + Number(body.amount));

    return json({ id, ok: true }, 201, cors);
  });

  router.post("/api/contributions/payments/:id/void", async ({ request, env, params, cors }) => {
    const user = await requireSession(request, env);
    const paymentId = params.id;
    const body = await request.json().catch(() => ({}));
    // Ownership check — a member can only void their own entries.
    const owned = await env.DB.prepare(`SELECT user_id FROM payments WHERE id = ?`).bind(paymentId).first();
    if (!owned || owned.user_id !== user.id) throw new HttpError(403, "Not your payment entry.");
    await env.DB.prepare(
      `UPDATE payments SET voided_at = datetime('now'), void_reason = ? WHERE id = ?`
    ).bind(body.reason || "", paymentId).run();
    return json({ ok: true }, 200, cors);
  });

  router.put("/api/contributions/payout", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);
    const body = await request.json();
    await env.DB.prepare(
      `INSERT INTO payouts (user_id, group_id, amount, received_date) VALUES (?,?,?,?)
       ON CONFLICT(user_id) DO UPDATE SET amount=excluded.amount, received_date=excluded.received_date, recorded_at=datetime('now')`
    ).bind(user.id, user.groupId, Number(body.amount) || 0, body.date || "").run();
    return json({ ok: true }, 200, cors);
  });

  // A member's own agreed contribution rate for a date, overriding the
  // shared schedule default for them only. amount = null clears it.
  router.put("/api/contributions/due-override", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);
    const body = await request.json();
    if (!body.scheduleRowId) throw new HttpError(400, "scheduleRowId is required.");
    if (body.amount === null || body.amount === "") {
      await env.DB.prepare(`DELETE FROM due_overrides WHERE user_id = ? AND schedule_row_id = ?`)
        .bind(user.id, body.scheduleRowId).run();
    } else {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new HttpError(400, "Amount must be zero or a positive number.");
      }
      await env.DB.prepare(
        `INSERT INTO due_overrides (user_id, group_id, schedule_row_id, amount) VALUES (?,?,?,?)
         ON CONFLICT(user_id, schedule_row_id) DO UPDATE SET amount=excluded.amount, updated_at=datetime('now')`
      ).bind(user.id, user.groupId, body.scheduleRowId, amount).run();
    }
    return json({ ok: true }, 200, cors);
  });

  // One-time onboarding step: apply the same agreed rate across every
  // listed date at once, so a new member never sits on the group
  // default by accident before entering their own rate.
  router.post("/api/contributions/due-overrides/bulk", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);
    const body = await request.json();
    const rate = Number(body.rate);
    if (!rate || rate <= 0) throw new HttpError(400, "Rate must be greater than zero.");
    if (!Array.isArray(body.scheduleRowIds)) throw new HttpError(400, "scheduleRowIds must be an array.");
    const stmts = body.scheduleRowIds.map((id) =>
      env.DB.prepare(
        `INSERT INTO due_overrides (user_id, group_id, schedule_row_id, amount) VALUES (?,?,?,?)
         ON CONFLICT(user_id, schedule_row_id) DO UPDATE SET amount=excluded.amount, updated_at=datetime('now')`
      ).bind(user.id, user.groupId, id, rate)
    );
    if (stmts.length) await env.DB.batch(stmts);
    return json({ ok: true }, 200, cors);
  });

  router.del("/api/contributions/me", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM payments WHERE user_id = ?`).bind(user.id),
      env.DB.prepare(`DELETE FROM payouts WHERE user_id = ?`).bind(user.id),
      env.DB.prepare(`DELETE FROM due_overrides WHERE user_id = ?`).bind(user.id),
      env.DB.prepare(`DELETE FROM subscriptions WHERE user_id = ?`).bind(user.id),
    ]);
    return json({ ok: true }, 200, cors);
  });
}
