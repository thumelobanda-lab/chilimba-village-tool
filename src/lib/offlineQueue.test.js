import { describe, expect, it } from "vitest";
import { dequeue, enqueue, overlayPendingLedgerWrites } from "./offlineQueue.js";

function makeItem(overrides = {}) {
  return {
    id: "outbox-1",
    path: "/api/contributions/payments",
    method: "POST",
    body: { id: "pay-1", scheduleRowId: "row-1", amount: 500, note: "" },
    headers: { Authorization: "Bearer t1" },
    groupSlug: "hillcrest",
    memberName: "Harriet",
    createdAt: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("enqueue/dequeue", () => {
  it("enqueue appends without mutating the original array", () => {
    const outbox = [];
    const next = enqueue(outbox, makeItem());
    expect(outbox).toHaveLength(0);
    expect(next).toHaveLength(1);
  });

  it("dequeue removes only the matching id", () => {
    const outbox = [makeItem({ id: "a" }), makeItem({ id: "b" })];
    const next = dequeue(outbox, "a");
    expect(next.map((i) => i.id)).toEqual(["b"]);
  });
});

describe("overlayPendingLedgerWrites", () => {
  it("adds a queued payment as a pendingSync entry", () => {
    const ledger = { payments: [], payoutInfo: { amount: 0, date: "" }, dueOverrides: {} };
    const result = overlayPendingLedgerWrites(ledger, [makeItem()]);
    expect(result.payments).toHaveLength(1);
    expect(result.payments[0]).toMatchObject({
      id: "pay-1",
      scheduleRowId: "row-1",
      amount: 500,
      status: "pending",
      pendingSync: true,
      voidedAt: null,
    });
  });

  it("does not duplicate a payment already present in the ledger (already synced)", () => {
    const ledger = { payments: [{ id: "pay-1", scheduleRowId: "row-1", amount: 500, voidedAt: null }] };
    const result = overlayPendingLedgerWrites(ledger, [makeItem()]);
    expect(result.payments).toHaveLength(1);
    expect(result.payments[0].pendingSync).toBeUndefined();
  });

  it("skips a malformed queued item with no body id rather than crashing", () => {
    const ledger = { payments: [] };
    const result = overlayPendingLedgerWrites(ledger, [makeItem({ body: { scheduleRowId: "row-1", amount: 500 } })]);
    expect(result.payments).toHaveLength(0);
  });

  it("overlays a queued void onto the matching payment", () => {
    const ledger = { payments: [{ id: "pay-1", scheduleRowId: "row-1", amount: 500, voidedAt: null }] };
    const voidItem = makeItem({
      id: "outbox-2",
      path: "/api/contributions/payments/pay-1/void",
      body: { reason: "wrong amount" },
      createdAt: "2026-01-01T11:00:00.000Z",
    });
    const result = overlayPendingLedgerWrites(ledger, [voidItem]);
    expect(result.payments[0]).toMatchObject({
      voidedAt: "2026-01-01T11:00:00.000Z",
      voidReason: "wrong amount",
      pendingSync: true,
    });
  });

  it("applies a queued add-then-void pair together, in order, even if the outbox array is reversed", () => {
    const ledger = { payments: [] };
    const addItem = makeItem({ createdAt: "2026-01-01T10:00:00.000Z" });
    const voidItem = makeItem({
      id: "outbox-2",
      path: "/api/contributions/payments/pay-1/void",
      body: { reason: "" },
      createdAt: "2026-01-01T11:00:00.000Z",
    });
    // Deliberately out of chronological order — the function must sort.
    const result = overlayPendingLedgerWrites(ledger, [voidItem, addItem]);
    expect(result.payments).toHaveLength(1);
    expect(result.payments[0]).toMatchObject({ id: "pay-1", voidedAt: "2026-01-01T11:00:00.000Z", pendingSync: true });
  });

  it("leaves an already-voided payment alone rather than overwriting the void reason", () => {
    const ledger = { payments: [{ id: "pay-1", voidedAt: "2026-01-01T09:00:00.000Z", voidReason: "original" }] };
    const voidItem = makeItem({
      id: "outbox-2",
      path: "/api/contributions/payments/pay-1/void",
      body: { reason: "duplicate retry" },
    });
    const result = overlayPendingLedgerWrites(ledger, [voidItem]);
    expect(result.payments[0].voidReason).toBe("original");
    expect(result.payments[0].pendingSync).toBeUndefined();
  });

  it("returns an unchanged shallow copy when there are no outbox items", () => {
    const ledger = { payments: [{ id: "pay-1" }], payoutInfo: { amount: 10 } };
    const result = overlayPendingLedgerWrites(ledger, []);
    expect(result).toEqual(ledger);
  });
});
