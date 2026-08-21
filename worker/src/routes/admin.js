import { requireAdmin } from "../auth.js";
import { HttpError } from "../httpError.js";
import { uid } from "../crypto.js";
import { json } from "../responses.js";
import { isRecipient as isRecipientHelper, resolveDue, findNextDue } from "../scheduleUtils.js";
import { wouldLeaveZeroAdmins } from "../adminUtils.js";
import { computeCommunityFundSplit, EFFECTIVE_CONTRIBUTION_SQL, COMMUNITY_FUND_ID } from "../communityFundSplit.js";
import { isSubscriptionActive } from "../subscriptionUtils.js";

export default function registerAdminRoutes(router) {
  // The admin roster: every active member, their role, when they joined,
  // and the next date they still owe something on — powers the
  // promote/demote UI and answers "who's paid, who's next" at a glance.
  // Newest-joined first (rather than alphabetical) so a member who just
  // signed up is immediately visible at the top instead of buried
  // wherever their name happens to sort — the roster was otherwise the
  // only place a new member ever showed up at all, with no notification
  // of any kind when someone joins.
  // Deliberately a fixed, small number of queries (config + members +
  // all due_overrides + all payments, once each) rather than looping a
  // per-member query per schedule date — same batching discipline as the
  // reminder sweep, for the same reason: this should stay fast whether
  // the group has 5 members or 500.
  router.get("/api/admin/members", async ({ request, env, cors }) => {
    const admin = await requireAdmin(request, env);

    const config = await env.DB.prepare(`SELECT schedule_json, recipient_exempt FROM groups WHERE id = ?`)
      .bind(admin.groupId).first();
    const schedule = JSON.parse(config?.schedule_json || "[]");
    const recipientExempt = !!config?.recipient_exempt;

    const membersResult = await env.DB.prepare(
      `SELECT display_name as name, role, created_at as joinedAt
       FROM users WHERE group_id = ? AND active = 1 ORDER BY created_at DESC`
    ).bind(admin.groupId).all();
    const members = membersResult.results || [];

    const overridesResult = await env.DB.prepare(
      `SELECT u.display_name as name, do.schedule_row_id as rowId, do.amount
       FROM due_overrides do JOIN users u ON u.id = do.user_id
       WHERE do.group_id = ?`
    ).bind(admin.groupId).all();
    const paidResult = await env.DB.prepare(
      `SELECT u.display_name as name, p.schedule_row_id as rowId, SUM(${EFFECTIVE_CONTRIBUTION_SQL}) as paid
       FROM payments p JOIN users u ON u.id = p.user_id
       WHERE p.group_id = ? AND p.voided_at IS NULL
       GROUP BY u.display_name, p.schedule_row_id`
    ).bind(admin.groupId).all();

    const overridesByMember = {};
    for (const o of overridesResult.results || []) {
      (overridesByMember[o.name] ||= {})[o.rowId] = o.amount;
    }
    const paidByMember = {};
    for (const p of paidResult.results || []) {
      (paidByMember[p.name] ||= {})[p.rowId] = p.paid;
    }

    const roster = members.map((m) => {
      const next = findNextDue(
        schedule, m.name, recipientExempt,
        overridesByMember[m.name] || {}, paidByMember[m.name] || {}
      );
      return {
        name: m.name,
        role: m.role,
        joinedAt: m.joinedAt,
        nextDueDate: next?.row.date || null,
        nextDueAmount: next?.balance || 0,
      };
    });

    return json({ members: roster }, 200, cors);
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

  // Removes a member — soft delete (see migrations/003 for why). Their
  // payment history is untouched; they simply can no longer log in and
  // drop off the roster. Deliberately restricted to non-admins: to
  // remove an admin, demote them first (existing, tested safeguard),
  // then remove — this avoids a path where someone accidentally removes
  // the group's only admin, or themselves, in one click.
  router.post("/api/admin/remove", async ({ request, env, cors }) => {
    const admin = await requireAdmin(request, env);
    const body = await request.json();
    if (!body.name || !body.name.trim()) throw new HttpError(400, "A name is required.");

    const target = await env.DB.prepare(`SELECT id, role FROM users WHERE group_id = ? AND name = ?`)
      .bind(admin.groupId, body.name.trim().toLowerCase()).first();
    if (!target) throw new HttpError(404, "No member with that name in your group.");
    if (target.role === "admin") {
      throw new HttpError(400, "This member is an admin — demote them first, then remove.");
    }

    await env.DB.batch([
      env.DB.prepare(`UPDATE users SET active = 0, removed_at = datetime('now') WHERE id = ?`).bind(target.id),
      env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(target.id), // log them out immediately
    ]);

    return json({ ok: true }, 200, cors);
  });

  // PINs are one-way hashed (see crypto.js) — there is no way to recover
  // or look up a forgotten one, only reset it. Clears pin_hash/pin_salt
  // (rather than deleting the account) so role, display name, and
  // payment history all survive untouched; login() in auth.js treats an
  // existing account with an empty pin_hash the same as a
  // brand-new signup for PIN purposes — whatever PIN the member types on
  // their next login simply becomes their new one, no old PIN needed.
  // Also clears any lockout, and signs them out of every existing
  // session immediately (same as remove) since the old PIN they're
  // signed in with is being invalidated.
  router.post("/api/admin/reset-pin", async ({ request, env, cors }) => {
    const admin = await requireAdmin(request, env);
    const body = await request.json();
    if (!body.name || !body.name.trim()) throw new HttpError(400, "A name is required.");

    const target = await env.DB.prepare(`SELECT id, active FROM users WHERE group_id = ? AND name = ?`)
      .bind(admin.groupId, body.name.trim().toLowerCase()).first();
    if (!target) throw new HttpError(404, "No member with that name in your group.");
    if (!target.active) throw new HttpError(400, "This member has been removed — nothing to reset.");

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE users SET pin_hash = '', pin_salt = '', failed_attempts = 0, locked_until = NULL WHERE id = ?`
      ).bind(target.id),
      env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(target.id),
    ]);

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
              (SELECT COALESCE(SUM(${EFFECTIVE_CONTRIBUTION_SQL}), 0) FROM payments WHERE user_id = u.id AND schedule_row_id = ? AND voided_at IS NULL) as paid
       FROM users u
       WHERE u.group_id = ?
       ORDER BY u.display_name COLLATE NOCASE`
    ).bind(rowId, rowId, admin.groupId).all();

    // Individual entries too, not just the aggregate — this is what lets
    // an admin confirm ONE payment without needing to know its id in
    // advance. One extra query, still scoped to this date + group.
    const entriesResult = await env.DB.prepare(
      `SELECT p.id, u.display_name as memberName, p.amount, p.recorded_at as recordedAt,
              p.confirmed_at as confirmedAt, p.confirmed_by as confirmedBy,
              p.community_fund_amount as communityFundAmount
       FROM payments p JOIN users u ON u.id = p.user_id
       WHERE p.schedule_row_id = ? AND p.group_id = ? AND p.voided_at IS NULL
       ORDER BY p.recorded_at ASC`
    ).bind(rowId, admin.groupId).all();
    const entriesByMember = {};
    for (const e of entriesResult.results || []) {
      (entriesByMember[e.memberName] ||= []).push(e);
    }

    const results = (members.results || []).map((m) => {
      const isRecipient = isRecipientHelper(row, m.name, recipientExempt);
      const due = resolveDue(row, m.name, recipientExempt, m.overrideAmount);
      return {
        name: m.name, due, paid: m.paid, balance: due - m.paid, isRecipient,
        entries: entriesByMember[m.name] || [],
      };
    });

    return json({ row, members: results }, 200, cors);
  });

  // Marks one payment entry as confirmed — this is a trust flag, not a
  // gate; the payment already counts fully toward due/paid/balance
  // whether confirmed or not. Scoped by joining through users so an
  // admin can only ever confirm a payment that belongs to their own
  // group's member, never one they happen to guess the id of.
  //
  // Confirmation is also the moment the group's community-fund split
  // (if any deduction is configured) actually applies: the deduction
  // rate in effect right now is frozen onto the payment as
  // community_fund_amount, and — if it's greater than 0 — a matching
  // fund_contributions row is credited to the reserved "Community Fund"
  // (see communityFundSplit.js). Idempotent: if this payment is already
  // confirmed, this is a no-op rather than re-crediting a second time.
  router.post("/api/admin/payments/:id/confirm", async ({ request, env, params, cors }) => {
    const admin = await requireAdmin(request, env);
    const owned = await env.DB.prepare(
      `SELECT p.id, p.amount, p.confirmed_at as confirmedAt, p.schedule_row_id as scheduleRowId,
              p.user_id as userId, u.display_name as displayName
       FROM payments p JOIN users u ON u.id = p.user_id WHERE p.id = ? AND u.group_id = ?`
    ).bind(params.id, admin.groupId).first();
    if (!owned) throw new HttpError(404, "Payment not found in your group.");
    if (owned.confirmedAt) return json({ ok: true }, 200, cors); // already confirmed — no-op

    const group = await env.DB.prepare(`SELECT community_fund_deduction, subscription_expires_at FROM groups WHERE id = ?`)
      .bind(admin.groupId).first();
    // Defense in depth: PUT /api/schedule already refuses to SET a
    // deduction rate on a free-tier group, but a subscription can also
    // EXPIRE after one was set — this makes sure a lapsed group's
    // payments stop splitting the moment it drops to free tier, not
    // just at the point someone tries to raise the rate again.
    const deductionRate = isSubscriptionActive(group?.subscription_expires_at) ? (group?.community_fund_deduction || 0) : 0;
    const { fundAmount } = computeCommunityFundSplit(owned.amount, deductionRate);

    const stmts = [
      env.DB.prepare(
        `UPDATE payments SET confirmed_at = datetime('now'), confirmed_by = ?, community_fund_amount = ? WHERE id = ?`
      ).bind(admin.name, fundAmount, params.id),
    ];
    if (fundAmount > 0) {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO fund_contributions (id, group_id, user_id, display_name, schedule_row_id, fund_id, amount, payment_id)
           VALUES (?,?,?,?,?,?,?,?)`
        ).bind(uid(), admin.groupId, owned.userId, owned.displayName, owned.scheduleRowId, COMMUNITY_FUND_ID, fundAmount, params.id)
      );
    }
    await env.DB.batch(stmts);
    return json({ ok: true }, 200, cors);
  });

  // Reverses confirm's split so "confirmed" and "credited to the fund"
  // stay a matching pair: resets community_fund_amount to 0 and removes
  // the fund_contributions row this specific payment created (matched by
  // payment_id, not by date — a member can have more than one payment
  // against the same date, and only this one's credit should go).
  router.post("/api/admin/payments/:id/unconfirm", async ({ request, env, params, cors }) => {
    const admin = await requireAdmin(request, env);
    const owned = await env.DB.prepare(
      `SELECT p.id FROM payments p JOIN users u ON u.id = p.user_id WHERE p.id = ? AND u.group_id = ?`
    ).bind(params.id, admin.groupId).first();
    if (!owned) throw new HttpError(404, "Payment not found in your group.");

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE payments SET confirmed_at = NULL, confirmed_by = NULL, community_fund_amount = 0 WHERE id = ?`
      ).bind(params.id),
      env.DB.prepare(`DELETE FROM fund_contributions WHERE payment_id = ?`).bind(params.id),
    ]);
    return json({ ok: true }, 200, cors);
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
