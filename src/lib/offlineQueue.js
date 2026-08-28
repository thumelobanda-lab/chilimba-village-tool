/**
 * Pure logic for the offline write outbox and the "pending sync" overlay
 * shown in the ledger while a queued write hasn't reached the server yet.
 * No localStorage/network access here — src/lib/api/core.js owns
 * persistence and wires these into realFetch; keeping the rules here
 * means both are unit-testable without a browser or a live Worker.
 *
 * One queued item: { id, path, method, body, headers, groupSlug,
 * memberName, createdAt }. `id` is the outbox entry's own id, used to
 * remove it once synced — separate from any id inside `body` (e.g. a
 * payment's own client-generated id, which the server is expected to
 * honor via INSERT OR IGNORE so a retried write can't create a
 * duplicate row — see worker/src/routes/contributions.js).
 */

export function enqueue(outbox, item) {
  return [...outbox, item];
}

export function dequeue(outbox, outboxId) {
  return outbox.filter((item) => item.id !== outboxId);
}

const VOID_PATH_RE = /^\/api\/contributions\/payments\/(.+)\/void$/;

/**
 * Overlays queued-but-unsynced payment writes onto a ledger (live or
 * cache-fallback) so a member sees their own just-logged payment (or
 * void) immediately, tagged `pendingSync: true` — distinct from the
 * existing `status: "pending"` (awaiting admin review), since this
 * entry hasn't even reached the server yet. Applied in createdAt order
 * so a queued void always lands after the add it targets.
 */
export function overlayPendingLedgerWrites(ledger, outboxItems) {
  const payments = [...(ledger?.payments || [])];
  const ordered = [...outboxItems].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  for (const item of ordered) {
    if (item.path === "/api/contributions/payments" && item.method === "POST") {
      const body = item.body || {};
      if (!body.id || payments.some((p) => p.id === body.id)) continue; // already reflected
      payments.push({
        id: body.id,
        scheduleRowId: body.scheduleRowId,
        amount: Number(body.amount) || 0,
        note: body.note || "",
        recordedAt: item.createdAt,
        recordedBy: item.memberName,
        voidedAt: null,
        confirmedAt: null,
        confirmedBy: null,
        communityFundAmount: 0,
        status: "pending",
        rejectedAt: null,
        rejectedBy: null,
        rejectionReason: null,
        pendingSync: true,
      });
      continue;
    }

    const voidMatch = item.method === "POST" && VOID_PATH_RE.exec(item.path);
    if (voidMatch) {
      const targetId = voidMatch[1];
      const idx = payments.findIndex((p) => p.id === targetId);
      if (idx !== -1 && !payments[idx].voidedAt) {
        payments[idx] = {
          ...payments[idx],
          voidedAt: item.createdAt,
          voidReason: item.body?.reason || "",
          pendingSync: true,
        };
      }
    }
  }

  return { ...ledger, payments };
}
