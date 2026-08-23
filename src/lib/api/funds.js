import { COMMUNITY_FUND_ID, COMMUNITY_FUND_NAME } from "../fundUtils.js";
import { MOCK_MODE, lsGet, lsSet, realFetch, currentSession, groupScopedKey } from "./core.js";

function uidFund() {
  return crypto.randomUUID ? crypto.randomUUID() : `f_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// ---------- Community funds — visible to ALL members ----------
// Shows fund balances (e.g. Future Sharing, Hospital Emergency) and a
// chronological feed of who has settled which date. This is the group's
// transparency feed — everyone sees it, not just admins, the way a
// physical ledger passed around at a meeting works. It only ever exposes
// {name, fund, amount, date} — never a member's balance, rate, or full
// payment history.
export async function getGroupFunds() {
  const session = currentSession();
  if (!session) throw new Error("Not signed in.");

  if (MOCK_MODE) {
    const config = lsGet(groupScopedKey(session, "group"), null);
    const namedFunds = config?.funds || [];
    const scheduleById = Object.fromEntries((config?.schedule || []).map((r) => [r.id, r]));
    const contributions = lsGet(groupScopedKey(session, "fund-contributions"), []);
    const loans = lsGet(groupScopedKey(session, "fund-loans"), []);
    const repayments = lsGet(groupScopedKey(session, "fund-loan-repayments"), []);
    const edits = lsGet(groupScopedKey(session, "fund-loan-edits"), []);

    const balanceByFund = {};
    contributions.forEach((c) => {
      balanceByFund[c.fundId] = (balanceByFund[c.fundId] || 0) + c.amount;
    });

    // Mirrors the Worker's funds route: synthesize the implicit
    // community fund whenever a deduction rate is configured, or —
    // even if it's since been zeroed out — whenever there's already
    // credited history, so past balance never silently disappears.
    const communityFundDeduction = Number(config?.communityFundDeduction) || 0;
    const hasCommunityFundHistory = balanceByFund[COMMUNITY_FUND_ID] !== undefined;
    const funds = communityFundDeduction > 0 || hasCommunityFundHistory
      ? [...namedFunds, { id: COMMUNITY_FUND_ID, name: COMMUNITY_FUND_NAME, amount: communityFundDeduction, loanable: false }]
      : namedFunds;

    const repaidByLoan = {};
    repayments.filter((r) => !r.voidedAt).forEach((r) => {
      repaidByLoan[r.loanId] = (repaidByLoan[r.loanId] || 0) + r.amount;
    });
    // "Still out on loan" nets every loan's amount against whatever's
    // been repaid so far, same as the Worker route — a partially repaid
    // loan still ties up its remaining balance even before its status
    // flips to 'repaid'.
    const outstandingByFund = {};
    loans.forEach((l) => {
      const remaining = l.amount - (repaidByLoan[l.id] || 0);
      outstandingByFund[l.fundId] = (outstandingByFund[l.fundId] || 0) + Math.max(0, remaining);
    });

    const fundsOut = funds.map((f) => {
      const balance = balanceByFund[f.id] || 0;
      const outstandingLoans = outstandingByFund[f.id] || 0;
      return { ...f, balance, outstandingLoans, available: f.loanable ? balance - outstandingLoans : balance };
    });

    const feed = [...contributions]
      .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))
      .slice(0, 50)
      .map((c) => ({
        ...c,
        fundName: funds.find((f) => f.id === c.fundId)?.name || c.fundId,
        scheduleDate: scheduleById[c.scheduleRowId]?.date || "",
        scheduleGroup: scheduleById[c.scheduleRowId]?.group || "",
      }));

    const loansOut = [...loans]
      .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt))
      .slice(0, 50)
      .map((l) => {
        const loanRepayments = repayments.filter((r) => r.loanId === l.id).sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
        const repaidTotal = loanRepayments.filter((r) => !r.voidedAt).reduce((s, r) => s + r.amount, 0);
        const loanEdits = edits.filter((e) => e.loanId === l.id).sort((a, b) => new Date(a.editedAt) - new Date(b.editedAt));
        return {
          ...l,
          fundName: funds.find((f) => f.id === l.fundId)?.name || l.fundId,
          repaidTotal,
          balance: Math.max(0, l.amount - repaidTotal),
          repayments: loanRepayments,
          edits: loanEdits,
        };
      });

    return { funds: fundsOut, feed, loans: loansOut };
  }

  return realFetch("/api/funds");
}

// ---------- Admin: loans against a loanable fund ----------
export async function issueLoan({ fundId, borrowerName, amount, notes = "" }) {
  const session = currentSession();
  if (!session || session.role !== "admin") throw new Error("Admin access required.");
  const amt = Number(amount);
  if (!amt || amt <= 0) throw new Error("Enter an amount greater than zero.");

  if (MOCK_MODE) {
    const config = lsGet(groupScopedKey(session, "group"), null);
    const fund = config?.funds?.find((f) => f.id === fundId);
    if (!fund) throw new Error("Unknown fund.");
    if (!fund.loanable) throw new Error(`${fund.name} is not marked as loanable.`);

    const contributions = lsGet(groupScopedKey(session, "fund-contributions"), []);
    const balance = contributions.filter((c) => c.fundId === fundId).reduce((s, c) => s + c.amount, 0);
    const loans = lsGet(groupScopedKey(session, "fund-loans"), []);
    const repayments = lsGet(groupScopedKey(session, "fund-loan-repayments"), []);
    const repaidByLoan = {};
    repayments.filter((r) => !r.voidedAt).forEach((r) => { repaidByLoan[r.loanId] = (repaidByLoan[r.loanId] || 0) + r.amount; });
    const outstanding = loans
      .filter((l) => l.fundId === fundId)
      .reduce((s, l) => s + Math.max(0, l.amount - (repaidByLoan[l.id] || 0)), 0);
    const available = balance - outstanding;
    if (amt > available) throw new Error(`Only K${available.toLocaleString()} is available in ${fund.name}.`);

    const loan = {
      id: uidFund(),
      fundId,
      borrowerName: borrowerName.trim(),
      amount: amt,
      notes,
      status: "outstanding",
      issuedBy: session.name,
      issuedAt: new Date().toISOString(),
      repaidAt: null,
    };
    lsSet(groupScopedKey(session, "fund-loans"), [...loans, loan]);
    return { id: loan.id, ok: true };
  }

  return realFetch("/api/admin/loans", {
    method: "POST",
    body: JSON.stringify({ fundId, borrowerName, amount: amt, notes }),
  });
}

// Records one repayment against a loan — append-only, mirroring the
// Worker's loan_repayments table (migration 014). Any amount up to
// what's still owed; the loan's status flips to 'repaid' automatically
// once the running balance reaches zero.
export async function repayLoan(loanId, amount) {
  const session = currentSession();
  if (!session || session.role !== "admin") throw new Error("Admin access required.");
  const amt = Number(amount);
  if (!amt || amt <= 0) throw new Error("Enter an amount greater than zero.");

  if (MOCK_MODE) {
    const loans = lsGet(groupScopedKey(session, "fund-loans"), []);
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) throw new Error("Loan not found.");

    const repayments = lsGet(groupScopedKey(session, "fund-loan-repayments"), []);
    const repaidSoFar = repayments.filter((r) => r.loanId === loanId && !r.voidedAt).reduce((s, r) => s + r.amount, 0);
    const remaining = loan.amount - repaidSoFar;
    if (remaining <= 0) throw new Error("This loan is already fully repaid.");
    if (amt > remaining) throw new Error(`Only K${remaining.toLocaleString()} is still owed on this loan.`);

    const entry = { id: uidFund(), loanId, amount: amt, recordedBy: session.name, recordedAt: new Date().toISOString() };
    lsSet(groupScopedKey(session, "fund-loan-repayments"), [...repayments, entry]);

    const newRemaining = remaining - amt;
    if (newRemaining <= 0) {
      const next = loans.map((l) => (l.id === loanId ? { ...l, status: "repaid", repaidAt: new Date().toISOString() } : l));
      lsSet(groupScopedKey(session, "fund-loans"), next);
    }
    return { ok: true, remaining: Math.max(0, newRemaining) };
  }

  return realFetch(`/api/admin/loans/${loanId}/repay`, { method: "POST", body: JSON.stringify({ amount: amt }) });
}

// Corrects a loan's own amount/borrower name (a typo at issuance) — a
// direct update, not append-only, since fund_loans is a single "who
// owes what" record rather than a summed ledger (repayments are the
// append-only part, see repayLoan above). The prior values are kept
// (fund-loan-edits / loan_edits) so every correction is still auditable.
export async function editLoan(loanId, { amount, borrowerName }) {
  const session = currentSession();
  if (!session || session.role !== "admin") throw new Error("Admin access required.");
  const amt = Number(amount);
  const name = (borrowerName || "").trim();
  if (!amt || amt <= 0) throw new Error("Enter an amount greater than zero.");
  if (!name) throw new Error("Borrower name is required.");

  if (MOCK_MODE) {
    const loans = lsGet(groupScopedKey(session, "fund-loans"), []);
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) throw new Error("Loan not found.");

    const repayments = lsGet(groupScopedKey(session, "fund-loan-repayments"), []);
    const repaidSoFar = repayments.filter((r) => r.loanId === loanId && !r.voidedAt).reduce((s, r) => s + r.amount, 0);
    if (amt < repaidSoFar) {
      throw new Error(`Can't set this below K${repaidSoFar.toLocaleString()} — that's already been repaid against it.`);
    }

    const edits = lsGet(groupScopedKey(session, "fund-loan-edits"), []);
    lsSet(groupScopedKey(session, "fund-loan-edits"), [
      ...edits,
      { id: uidFund(), loanId, previousAmount: loan.amount, previousBorrowerName: loan.borrowerName, editedBy: session.name, editedAt: new Date().toISOString() },
    ]);

    const nowRepaid = amt - repaidSoFar <= 0;
    const next = loans.map((l) =>
      l.id === loanId
        ? { ...l, amount: amt, borrowerName: name, status: nowRepaid ? "repaid" : "outstanding", repaidAt: nowRepaid ? (l.repaidAt || new Date().toISOString()) : null }
        : l
    );
    lsSet(groupScopedKey(session, "fund-loans"), next);
    return { ok: true };
  }

  return realFetch(`/api/admin/loans/${loanId}`, { method: "PUT", body: JSON.stringify({ amount: amt, borrowerName: name }) });
}

// Voids one repayment entry (a mis-keyed amount) — kept append-only, same
// pattern as voiding a payment: the wrong entry stays visible, struck
// through, never deleted or overwritten. If it drops a "repaid" loan's
// total back below its amount, the loan flips back to 'outstanding'.
export async function voidRepayment(loanId, repaymentId, reason = "") {
  const session = currentSession();
  if (!session || session.role !== "admin") throw new Error("Admin access required.");

  if (MOCK_MODE) {
    const repayments = lsGet(groupScopedKey(session, "fund-loan-repayments"), []);
    const target = repayments.find((r) => r.id === repaymentId && r.loanId === loanId);
    if (!target) throw new Error("Repayment not found.");
    if (target.voidedAt) throw new Error("This repayment has already been voided.");

    lsSet(
      groupScopedKey(session, "fund-loan-repayments"),
      repayments.map((r) => (r.id === repaymentId ? { ...r, voidedAt: new Date().toISOString(), voidReason: reason || "Edited — voided by an admin" } : r))
    );

    const loans = lsGet(groupScopedKey(session, "fund-loans"), []);
    const loan = loans.find((l) => l.id === loanId);
    if (loan?.status === "repaid") {
      lsSet(groupScopedKey(session, "fund-loans"), loans.map((l) => (l.id === loanId ? { ...l, status: "outstanding", repaidAt: null } : l)));
    }
    return { ok: true };
  }

  return realFetch(`/api/admin/loans/${loanId}/repayments/${repaymentId}/void`, { method: "POST", body: JSON.stringify({ reason }) });
}
