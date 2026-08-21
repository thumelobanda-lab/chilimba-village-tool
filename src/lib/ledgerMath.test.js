import { describe, it, expect } from "vitest";
import { computeLedgerTotals, effectiveContribution } from "./ledgerMath.js";

const baseSchedule = [
  { id: "d1", date: "20 Jun 2026", group: "GROUP 1", payees: ["Doreen"], due: 1200 },
  { id: "d2", date: "4 Jul 2026", group: "GROUP 2", payees: ["Harriet"], due: 1200 },
  { id: "d3", date: "18 Jul 2026", group: "GROUP 3", payees: ["Sarah"], due: 1500 },
  { id: "d4", date: "1 Aug 2026", group: "GROUP 4", payees: ["Elizabeth"], due: 1700 },
];

function ledger(overrides = {}) {
  return { payments: [], payoutInfo: { amount: 0, date: "" }, dueOverrides: {}, ...overrides };
}

describe("computeLedgerTotals", () => {
  it("zeroes out due on the signed-in member's own payout date when recipients are exempt", () => {
    const totals = computeLedgerTotals({
      schedule: baseSchedule,
      ledger: ledger(),
      sessionName: "Harriet",
      recipientExempt: true,
    });
    const ownRow = totals.rowsComputed.find((r) => r.id === "d2");
    expect(ownRow.due).toBe(0);
    expect(ownRow.balance).toBe(0);
  });

  it("does not exempt the recipient's row when recipientExempt is false", () => {
    const totals = computeLedgerTotals({
      schedule: baseSchedule,
      ledger: ledger(),
      sessionName: "Harriet",
      recipientExempt: false,
    });
    const ownRow = totals.rowsComputed.find((r) => r.id === "d2");
    expect(ownRow.due).toBe(1200);
  });

  it("applies a per-date due override in place of the schedule default", () => {
    const totals = computeLedgerTotals({
      schedule: baseSchedule,
      ledger: ledger({ dueOverrides: { d4: 1650 } }),
      sessionName: "Someone Else",
      recipientExempt: true,
    });
    const row = totals.rowsComputed.find((r) => r.id === "d4");
    expect(row.due).toBe(1650);
    expect(row.defaultDue).toBe(1700);
    expect(row.overridden).toBe(true);
  });

  it("excludes voided payments from paid totals and balance", () => {
    const totals = computeLedgerTotals({
      schedule: baseSchedule,
      ledger: ledger({
        payments: [
          { scheduleRowId: "d3", amount: 1500, voidedAt: null },
          { scheduleRowId: "d3", amount: 500, voidedAt: "2026-01-01T00:00:00Z" },
        ],
      }),
      sessionName: "Someone Else",
      recipientExempt: true,
    });
    const row = totals.rowsComputed.find((r) => r.id === "d3");
    expect(row.paid).toBe(1500);
    expect(row.balance).toBe(0);
  });

  it("sums multiple non-voided payments toward the same date", () => {
    const totals = computeLedgerTotals({
      schedule: baseSchedule,
      ledger: ledger({
        payments: [
          { scheduleRowId: "d3", amount: 1000, voidedAt: null },
          { scheduleRowId: "d3", amount: 500, voidedAt: null },
        ],
      }),
      sessionName: "Someone Else",
      recipientExempt: true,
    });
    const row = totals.rowsComputed.find((r) => r.id === "d3");
    expect(row.paid).toBe(1500);
    expect(row.balance).toBe(0);
  });

  it("computes cumulative paid as a running total down the schedule", () => {
    const totals = computeLedgerTotals({
      schedule: baseSchedule,
      ledger: ledger({
        payments: [
          { scheduleRowId: "d1", amount: 1200, voidedAt: null },
          { scheduleRowId: "d3", amount: 1500, voidedAt: null },
        ],
      }),
      sessionName: "Someone Else",
      recipientExempt: true,
    });
    expect(totals.rowsComputed.find((r) => r.id === "d1").cumulative).toBe(1200);
    // d2 has no payment but cumulative carries forward
    expect(totals.rowsComputed.find((r) => r.id === "d2").cumulative).toBe(1200);
    expect(totals.rowsComputed.find((r) => r.id === "d3").cumulative).toBe(2700);
    expect(totals.rowsComputed.find((r) => r.id === "d4").cumulative).toBe(2700);
  });

  it("computes net position as payout received minus total paid", () => {
    const totals = computeLedgerTotals({
      schedule: baseSchedule,
      ledger: ledger({
        payments: [{ scheduleRowId: "d1", amount: 1200, voidedAt: null }],
        payoutInfo: { amount: 25700 },
      }),
      sessionName: "Harriet",
      recipientExempt: true,
    });
    expect(totals.paid).toBe(1200);
    expect(totals.net).toBe(25700 - 1200);
  });

  it("spreads a positive net position evenly across remaining unpaid dates for the suggested rate", () => {
    const totals = computeLedgerTotals({
      schedule: baseSchedule,
      ledger: ledger({
        payments: [
          { scheduleRowId: "d1", amount: 1200, voidedAt: null },
          { scheduleRowId: "d3", amount: 1500, voidedAt: null },
        ],
        payoutInfo: { amount: 25700 },
      }),
      sessionName: "Harriet", // d2 exempt as recipient, d1 and d3 settled, d4 remains
      recipientExempt: true,
    });
    // remaining unpaid: only d4 (d2 is exempt so balance 0, not counted)
    expect(totals.remainingCount).toBe(1);
    expect(totals.suggestedRate).toBe(25700 - 1200 - 1500);
  });

  it("does not suggest a negative rate when the member has already paid more than received", () => {
    const totals = computeLedgerTotals({
      schedule: baseSchedule,
      ledger: ledger({
        payments: [
          { scheduleRowId: "d1", amount: 1200, voidedAt: null },
          { scheduleRowId: "d3", amount: 1500, voidedAt: null },
        ],
        payoutInfo: { amount: 100 }, // far less than paid already
      }),
      sessionName: "Someone Else",
      recipientExempt: true,
    });
    // net is negative, so suggested rate should floor at 0, not go negative
    expect(totals.suggestedRate).toBe(0);
  });

  it("shows '—'-worthy state (remainingCount 0) once every date is settled", () => {
    const fullSchedule = [{ id: "d1", date: "1 Jan 2026", group: "GROUP 1", payees: ["Someone Else"], due: 1000 }];
    const totals = computeLedgerTotals({
      schedule: fullSchedule,
      ledger: ledger({ payments: [{ scheduleRowId: "d1", amount: 1000, voidedAt: null }] }),
      sessionName: "A Different Member",
      recipientExempt: true,
    });
    expect(totals.remainingCount).toBe(0);
    expect(totals.suggestedRate).toBe(0);
  });

  it("handles an empty schedule without throwing", () => {
    const totals = computeLedgerTotals({
      schedule: [],
      ledger: ledger(),
      sessionName: "Harriet",
      recipientExempt: true,
    });
    expect(totals.due).toBe(0);
    expect(totals.paid).toBe(0);
    expect(totals.rowsComputed).toEqual([]);
  });

  it("the Suggested column shows actual amount paid on settled rows, not the break-even rate", () => {
    const totals = computeLedgerTotals({
      schedule: baseSchedule,
      ledger: ledger({
        payments: [{ scheduleRowId: "d1", amount: 1200, voidedAt: null }],
        payoutInfo: { amount: 4000 },
      }),
      sessionName: "Someone Else",
      recipientExempt: true,
    });
    const settledRow = totals.rowsComputed.find((r) => r.id === "d1");
    expect(settledRow.suggested).toBe(1200); // actual paid, not the break-even rate
  });

  it("counts an unconfirmed payment fully toward paid, even with a community fund deduction configured", () => {
    const totals = computeLedgerTotals({
      schedule: baseSchedule,
      ledger: ledger({
        payments: [{ scheduleRowId: "d1", amount: 1200, voidedAt: null, confirmedAt: null, communityFundAmount: 0 }],
      }),
      sessionName: "Someone Else",
      recipientExempt: true,
    });
    expect(totals.rowsComputed.find((r) => r.id === "d1").paid).toBe(1200);
  });

  it("counts only the remainder toward paid once a split payment is confirmed", () => {
    const totals = computeLedgerTotals({
      schedule: baseSchedule,
      ledger: ledger({
        payments: [
          {
            scheduleRowId: "d1",
            amount: 1200,
            voidedAt: null,
            confirmedAt: "2026-08-20T00:00:00Z",
            communityFundAmount: 200,
          },
        ],
      }),
      sessionName: "Someone Else",
      recipientExempt: true,
    });
    const row = totals.rowsComputed.find((r) => r.id === "d1");
    expect(row.paid).toBe(1000);
    expect(row.balance).toBe(200); // due 1200 - effective paid 1000
  });
});

describe("effectiveContribution", () => {
  it("counts the full amount for an unconfirmed payment", () => {
    expect(effectiveContribution({ amount: 50, confirmedAt: null, communityFundAmount: 0 })).toBe(50);
  });

  it("counts only the remainder for a confirmed, split payment", () => {
    expect(
      effectiveContribution({ amount: 50, confirmedAt: "2026-08-20T00:00:00Z", communityFundAmount: 10 })
    ).toBe(40);
  });

  it("counts 0 for a voided payment even if confirmed and split", () => {
    expect(
      effectiveContribution({
        amount: 50,
        confirmedAt: "2026-08-20T00:00:00Z",
        communityFundAmount: 10,
        voidedAt: "2026-08-21T00:00:00Z",
      })
    ).toBe(0);
  });

  it("treats a missing communityFundAmount as 0", () => {
    expect(effectiveContribution({ amount: 50, confirmedAt: "2026-08-20T00:00:00Z" })).toBe(50);
  });

  it("counts 0 for a pending (member-submitted, not yet reviewed) payment", () => {
    expect(effectiveContribution({ amount: 50, confirmedAt: null, status: "pending" })).toBe(0);
  });

  it("counts 0 for a rejected payment", () => {
    expect(effectiveContribution({ amount: 50, confirmedAt: null, status: "rejected" })).toBe(0);
  });

  it("counts the full amount once a pending payment is confirmed", () => {
    expect(
      effectiveContribution({ amount: 50, status: "pending", confirmedAt: "2026-08-20T00:00:00Z", communityFundAmount: 0 })
    ).toBe(50);
  });

  it("does not gate a legacy unconfirmed payment (status null, logged before migration 009)", () => {
    expect(effectiveContribution({ amount: 50, confirmedAt: null, status: null })).toBe(50);
  });
});
