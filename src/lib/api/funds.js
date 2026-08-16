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
    const funds = config?.funds || [];
    const scheduleById = Object.fromEntries((config?.schedule || []).map((r) => [r.id, r]));
    const contributions = lsGet(groupScopedKey(session, "fund-contributions"), []);
    const loans = lsGet(groupScopedKey(session, "fund-loans"), []);

    const balanceByFund = {};
    contributions.forEach((c) => {
      balanceByFund[c.fundId] = (balanceByFund[c.fundId] || 0) + c.amount;
    });
    const outstandingByFund = {};
    loans.filter((l) => l.status === "outstanding").forEach((l) => {
      outstandingByFund[l.fundId] = (outstandingByFund[l.fundId] || 0) + l.amount;
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
      .map((l) => ({ ...l, fundName: funds.find((f) => f.id === l.fundId)?.name || l.fundId }));

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
    const outstanding = loans.filter((l) => l.fundId === fundId && l.status === "outstanding").reduce((s, l) => s + l.amount, 0);
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

export async function repayLoan(loanId) {
  const session = currentSession();
  if (!session || session.role !== "admin") throw new Error("Admin access required.");

  if (MOCK_MODE) {
    const loans = lsGet(groupScopedKey(session, "fund-loans"), []);
    const next = loans.map((l) =>
      l.id === loanId ? { ...l, status: "repaid", repaidAt: new Date().toISOString() } : l
    );
    lsSet(groupScopedKey(session, "fund-loans"), next);
    return { ok: true };
  }

  return realFetch(`/api/admin/loans/${loanId}/repay`, { method: "POST" });
}
