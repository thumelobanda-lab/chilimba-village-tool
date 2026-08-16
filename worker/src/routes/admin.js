import { requireAdmin } from "../auth.js";
import { HttpError } from "../httpError.js";
import { uid } from "../crypto.js";
import { json } from "../responses.js";
import { isRecipient as isRecipientHelper, resolveDue } from "../scheduleUtils.js";
import { wouldLeaveZeroAdmins } from "../adminUtils.js";

export default function registerAdminRoutes(router) {
  // Every member of the admin's OWN group, with their current role —
  // powers the promote/demote UI in Group Setup. Never crosses groups:
  // scoped by admin.groupId the same as every other admin route.
  router.get("/api/admin/members", async ({ request, env, cors }) => {
    const admin = await requireAdmin(request, env);
    const members = await env.DB.prepare(
      `SELECT display_name as name, role FROM users WHERE group_id = ? ORDER BY display_name COLLATE NOCASE`
    ).bind(admin.groupId).all();
    return json({ members: members.results || [] }, 200, cors);
  });

  // Self-service promotion: any existing admin can promote another
  // member of their OWN group. This is deliberately the only self-service
  // path for an EXISTING group — becoming the first admin of a NEW group
  // still only happens through createGroup(). Scoped by group_id so an
  // admin can never promote someone outside their own group, even if they
  // somehow knew that person's exact name.
  router.post("/api/admin/promote", async ({ request, env, cors }) => {
    const admin = await requireAdmin(request, env);
    const body = await request.json();
    if (!body.name || !body.name.trim()) throw new HttpError(400, "A name is required.");

    const target = await env.DB.prepare(`SELECT id FROM users WHERE group_id = ? AND name = ?`)
      .bind(admin.groupId, body.name.trim().toLowerCase()).first();
    if (!target) throw new HttpError(404, "No member with that name in your group.");

    await env.DB.prepare(`UPDATE users SET role = 'admin' WHERE id = ?`).bind(target.id).run();
    return json({ ok: true }, 200, cors);
  });

  // Demotes an admin back to member — blocked if it would leave the
  // group with zero admins (see wouldLeaveZeroAdmins in adminUtils.js),
  // since there'd be no self-service way back from that state.
  router.post("/api/admin/demote", async ({ request, env, cors }) => {
    const admin = await requireAdmin(request, env);
    const body = await request.json();
    if (!body.name || !body.name.trim()) throw new HttpError(400, "A name is required.");

    const membersResult = await env.DB.prepare(
      `SELECT display_name as name, role FROM users WHERE group_id = ?`
    ).bind(admin.groupId).all();
    const members = membersResult.results || [];

    if (wouldLeaveZeroAdmins(members, body.name)) {
      throw new HttpError(400, "This is the only admin left — promote someone else first.");
    }

    const target = await env.DB.prepare(`SELECT id FROM users WHERE group_id = ? AND name = ?`)
      .bind(admin.groupId, body.name.trim().toLowerCase()).first();
    if (!target) throw new HttpError(404, "No member with that name in your group.");

    await env.DB.prepare(`UPDATE users SET role = 'member' WHERE id = ?`).bind(target.id).run();
    return json({ ok: true }, 200, cors);
  });

  // Aggregates every member's due/paid/balance for one schedule date —
  // the only place in the API that reads across members, and now the
  // only place that reads across GROUPS too if group_id is ever missed.
  // Every query here is scoped to admin.groupId.
  router.get("/api/admin/reconciliation", async ({ request, env, url, cors }) => {
    const admin = await requireAdmin(request, env);
    const rowId = url.searchParams.get("rowId");
    if (!rowId) throw new HttpError(400, "rowId is required.");

    const config = await env.DB.prepare(`SELECT * FROM groups WHERE id = ?`).bind(admin.groupId).first();
    const schedule = JSON.parse(config?.schedule_json || "[]");
    const row = schedule.find((r) => r.id === rowId);
    if (!row) throw new HttpError(404, "Unknown schedule date.");
    const recipientExempt = !!config.recipient_exempt;

    const members = await env.DB.prepare(
      `SELECT u.id, u.display_name as name,
              (SELECT amount FROM due_overrides WHERE user_id = u.id AND schedule_row_id = ?) as overrideAmount,
              (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE user_id = u.id AND schedule_row_id = ? AND voided_at IS NULL) as paid
       FROM users u
       WHERE u.group_id = ?
       ORDER BY u.display_name COLLATE NOCASE`
    ).bind(rowId, rowId, admin.groupId).all();

    const results = (members.results || []).map((m) => {
      const isRecipient = isRecipientHelper(row, m.name, recipientExempt);
      const due = resolveDue(row, m.name, recipientExempt, m.overrideAmount);
      return { name: m.name, due, paid: m.paid, balance: due - m.paid, isRecipient };
    });

    return json({ row, members: results }, 200, cors);
  });

  router.post("/api/admin/loans", async ({ request, env, cors }) => {
    const admin = await requireAdmin(request, env);
    const body = await request.json();
    if (!body.fundId || !body.borrowerName || !body.amount) {
      throw new HttpError(400, "fundId, borrowerName, and amount are required.");
    }
    const amount = Number(body.amount);
    if (!amount || amount <= 0) throw new HttpError(400, "Amount must be greater than zero.");

    const config = await env.DB.prepare(`SELECT * FROM groups WHERE id = ?`).bind(admin.groupId).first();
    const funds = JSON.parse(config?.funds_json || "[]");
    const fund = funds.find((f) => f.id === body.fundId);
    if (!fund) throw new HttpError(404, "Unknown fund.");
    if (!fund.loanable) throw new HttpError(400, `${fund.name} is not marked as loanable.`);

    // Scoped by group_id, not just fund_id — two different groups can
    // both name a fund "future" and must never share a balance.
    const balanceRow = await env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM fund_contributions WHERE group_id = ? AND fund_id = ?`
    ).bind(admin.groupId, body.fundId).first();
    const outstandingRow = await env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM fund_loans WHERE group_id = ? AND fund_id = ? AND status = 'outstanding'`
    ).bind(admin.groupId, body.fundId).first();
    const available = balanceRow.total - outstandingRow.total;
    if (amount > available) {
      throw new HttpError(400, `Only K${available.toLocaleString()} is available in ${fund.name}.`);
    }

    const borrowerUser = await env.DB.prepare(`SELECT id FROM users WHERE group_id = ? AND name = ?`)
      .bind(admin.groupId, body.borrowerName.trim().toLowerCase()).first();

    const id = uid();
    await env.DB.prepare(
      `INSERT INTO fund_loans (id, group_id, fund_id, borrower_user_id, borrower_name, amount, notes, issued_by)
       VALUES (?,?,?,?,?,?,?,?)`
    ).bind(id, admin.groupId, body.fundId, borrowerUser?.id || null, body.borrowerName.trim(), amount, body.notes || "", admin.name).run();

    return json({ id, ok: true }, 201, cors);
  });

  router.post("/api/admin/loans/:id/repay", async ({ request, env, params, cors }) => {
    const admin = await requireAdmin(request, env);
    // Ownership check — an admin can only repay a loan that belongs to
    // their own group, not any loan id they happen to guess or be told.
    await env.DB.prepare(
      `UPDATE fund_loans SET status = 'repaid', repaid_at = datetime('now') WHERE id = ? AND group_id = ? AND status = 'outstanding'`
    ).bind(params.id, admin.groupId).run();
    return json({ ok: true }, 200, cors);
  });
}
