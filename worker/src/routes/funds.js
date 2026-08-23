import { requireSession } from "../auth.js";
import { json } from "../responses.js";
import { COMMUNITY_FUND_ID, COMMUNITY_FUND_NAME } from "../communityFundSplit.js";

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
    const namedFunds = JSON.parse(config?.funds_json || "[]");
    const schedule = JSON.parse(config?.schedule_json || "[]");
    const scheduleById = Object.fromEntries(schedule.map((r) => [r.id, r]));

    const balances = await env.DB.prepare(
      `SELECT fund_id as fundId, COALESCE(SUM(amount), 0) as balance FROM fund_contributions WHERE group_id = ? GROUP BY fund_id`
    ).bind(user.groupId).all();
    const balanceByFund = Object.fromEntries((balances.results || []).map((b) => [b.fundId, b.balance]));

    // Late penalties (migration 016) always land in the community fund,
    // but live in their own table (see that migration's comment for
    // why) — fold the total in here so the fund's balance/available
    // figures include them, same as any regular split credit would.
    const penaltyTotalRow = await env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM late_penalties WHERE group_id = ?`
    ).bind(user.groupId).first();
    const latePenaltyTotal = penaltyTotalRow.total || 0;
    if (latePenaltyTotal > 0) {
      balanceByFund[COMMUNITY_FUND_ID] = (balanceByFund[COMMUNITY_FUND_ID] || 0) + latePenaltyTotal;
    }

    // The community-fund split (see communityFundSplit.js) has no entry
    // in funds_json — it's a single implicit fund tied to the group's
    // community_fund_deduction setting, not one of the admin's own named
    // funds. Synthesize it here so it shows up in Community.jsx and the
    // Dashboard's fund total automatically, same as any named fund.
    // Included whenever a deduction rate is configured, OR — even if the
    // rate's since been zeroed out — whenever there's already credited
    // history (a split OR a penalty), so past balance never silently
    // disappears from view.
    const communityFundDeduction = Number(config?.community_fund_deduction) || 0;
    const hasCommunityFundHistory = balanceByFund[COMMUNITY_FUND_ID] !== undefined;
    const funds = communityFundDeduction > 0 || hasCommunityFundHistory
      ? [...namedFunds, { id: COMMUNITY_FUND_ID, name: COMMUNITY_FUND_NAME, amount: communityFundDeduction, loanable: false }]
      : namedFunds;

    // "Still out on loan" per fund — every loan's amount minus whatever's
    // been (non-voided) repaid against it, same netting as the issuance
    // check in admin.js. Summing only status='outstanding' loans here
    // would overcount: a loan can be PARTIALLY repaid and still carry
    // 'outstanding' status, so its already-repaid portion must still be
    // subtracted or "available to lend" reads lower than it really is.
    const loanTotals = await env.DB.prepare(
      `SELECT fund_id as fundId, COALESCE(SUM(amount), 0) as total FROM fund_loans WHERE group_id = ? GROUP BY fund_id`
    ).bind(user.groupId).all();
    const loanTotalByFund = Object.fromEntries((loanTotals.results || []).map((o) => [o.fundId, o.total]));
    const repaidTotals = await env.DB.prepare(
      `SELECT fl.fund_id as fundId, COALESCE(SUM(lr.amount), 0) as total
       FROM loan_repayments lr JOIN fund_loans fl ON fl.id = lr.loan_id
       WHERE fl.group_id = ? AND lr.voided_at IS NULL GROUP BY fl.fund_id`
    ).bind(user.groupId).all();
    const repaidTotalByFund = Object.fromEntries((repaidTotals.results || []).map((o) => [o.fundId, o.total]));
    const outstandingByFund = Object.fromEntries(
      Object.keys(loanTotalByFund).map((fundId) => [
        fundId,
        Math.max(0, loanTotalByFund[fundId] - (repaidTotalByFund[fundId] || 0)),
      ])
    );

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
    // Late penalties (migration 016) get their own feed rows, tagged
    // kind: "penalty" — Community.jsx renders these with distinct
    // wording ("K20 late penalty — added to Group Savings Fund") rather
    // than folding them into the regular contribution line, so a penalty
    // is never mistaken for an ordinary settlement.
    const penaltyRows = await env.DB.prepare(
      `SELECT id, display_name as displayName, schedule_row_id as scheduleRowId, amount, recorded_at as recordedAt
       FROM late_penalties WHERE group_id = ? ORDER BY recorded_at DESC LIMIT 50`
    ).bind(user.groupId).all();
    const feed = [
      ...(feedRows.results || []).map((r) => ({ ...r, kind: "contribution" })),
      ...(penaltyRows.results || []).map((r) => ({ ...r, kind: "penalty", fundId: COMMUNITY_FUND_ID })),
    ]
      .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))
      .slice(0, 50)
      .map((r) => ({
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

    // Every repayment against any of this group's loans, in one query —
    // grouped client-side (here, not in SQL) by loan so each loan's own
    // balance and full repayment history travel together. Same
    // full-auditability standard as fund_contributions: nothing is ever
    // collapsed into just a total, the individual entries are always
    // there to inspect (admin.js's Loans.jsx and, for a member's own
    // loan, Dashboard.jsx both read this).
    const repaymentRows = await env.DB.prepare(
      `SELECT lr.id, lr.loan_id as loanId, lr.amount, lr.recorded_by as recordedBy, lr.recorded_at as recordedAt,
              lr.voided_at as voidedAt, lr.void_reason as voidReason
       FROM loan_repayments lr JOIN fund_loans fl ON fl.id = lr.loan_id
       WHERE fl.group_id = ? ORDER BY lr.recorded_at ASC`
    ).bind(user.groupId).all();
    const repaymentsByLoan = {};
    for (const r of repaymentRows.results || []) {
      (repaymentsByLoan[r.loanId] ||= []).push(r);
    }

    // Prior amount/borrower-name values before a correction (migration
    // 015) — kept alongside repayment history so the same expandable
    // panel shows a loan's full audit trail, not just its repayments.
    const editRows = await env.DB.prepare(
      `SELECT le.id, le.loan_id as loanId, le.previous_amount as previousAmount,
              le.previous_borrower_name as previousBorrowerName, le.edited_by as editedBy, le.edited_at as editedAt
       FROM loan_edits le JOIN fund_loans fl ON fl.id = le.loan_id
       WHERE fl.group_id = ? ORDER BY le.edited_at ASC`
    ).bind(user.groupId).all();
    const editsByLoan = {};
    for (const e of editRows.results || []) {
      (editsByLoan[e.loanId] ||= []).push(e);
    }

    const loans = (loanRows.results || []).map((l) => {
      const repayments = repaymentsByLoan[l.id] || [];
      const repaidTotal = repayments.filter((r) => !r.voidedAt).reduce((sum, r) => sum + r.amount, 0);
      return {
        ...l,
        fundName: funds.find((f) => f.id === l.fundId)?.name || l.fundId,
        repaidTotal,
        balance: Math.max(0, l.amount - repaidTotal),
        repayments,
        edits: editsByLoan[l.id] || [],
      };
    });

    return json({ funds: fundsOut, feed, loans }, 200, cors);
  });
}
