import { requireSession } from "../auth.js";
import { json } from "../responses.js";

// Shows fund balances (and available balance for loanable funds), a
// chronological feed of contributions, and outstanding/repaid loans.
// Names, amounts, and dates only — never a member's full ledger.
//
// Every query below filters on group_id = user.groupId. Without that,
// this route would aggregate and list every group's fund activity
// together — the highest-risk spot for a cross-tenant leak in this file,
// since (unlike payments) fund_contributions/fund_loans were never
// filtered through a user_id that already implied one group.
export default function registerFundsRoutes(router) {
  router.get("/api/funds", async ({ request, env, cors }) => {
    const user = await requireSession(request, env);
    const config = await env.DB.prepare(`SELECT * FROM groups WHERE id = ?`).bind(user.groupId).first();
    const funds = JSON.parse(config?.funds_json || "[]");
    const schedule = JSON.parse(config?.schedule_json || "[]");
    const scheduleById = Object.fromEntries(schedule.map((r) => [r.id, r]));

    const balances = await env.DB.prepare(
      `SELECT fund_id as fundId, COALESCE(SUM(amount), 0) as balance FROM fund_contributions WHERE group_id = ? GROUP BY fund_id`
    ).bind(user.groupId).all();
    const balanceByFund = Object.fromEntries((balances.results || []).map((b) => [b.fundId, b.balance]));

    const outstanding = await env.DB.prepare(
      `SELECT fund_id as fundId, COALESCE(SUM(amount), 0) as total FROM fund_loans WHERE group_id = ? AND status = 'outstanding' GROUP BY fund_id`
    ).bind(user.groupId).all();
    const outstandingByFund = Object.fromEntries((outstanding.results || []).map((o) => [o.fundId, o.total]));

    const fundsOut = funds.map((f) => {
      const balance = balanceByFund[f.id] || 0;
      const outstandingLoans = outstandingByFund[f.id] || 0;
      return {
        ...f,
        balance,
        outstandingLoans,
        available: f.loanable ? balance - outstandingLoans : balance,
      };
    });

    const feedRows = await env.DB.prepare(
      `SELECT id, display_name as displayName, schedule_row_id as scheduleRowId, fund_id as fundId, amount, recorded_at as recordedAt
       FROM fund_contributions WHERE group_id = ? ORDER BY recorded_at DESC LIMIT 50`
    ).bind(user.groupId).all();
    const feed = (feedRows.results || []).map((r) => ({
      ...r,
      fundName: funds.find((f) => f.id === r.fundId)?.name || r.fundId,
      scheduleDate: scheduleById[r.scheduleRowId]?.date || "",
      scheduleGroup: scheduleById[r.scheduleRowId]?.group || "",
    }));

    const loanRows = await env.DB.prepare(
      `SELECT id, fund_id as fundId, borrower_name as borrowerName, amount, notes, status,
              issued_by as issuedBy, issued_at as issuedAt, repaid_at as repaidAt
       FROM fund_loans WHERE group_id = ? ORDER BY issued_at DESC LIMIT 50`
    ).bind(user.groupId).all();
    const loans = (loanRows.results || []).map((l) => ({
      ...l,
      fundName: funds.find((f) => f.id === l.fundId)?.name || l.fundId,
    }));

    return json({ funds: fundsOut, feed, loans }, 200, cors);
  });
}
